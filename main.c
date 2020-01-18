#include <stdlib.h>
#include <libgen.h>
#include <zip.h>
#include <errno.h>
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>

// The name used for the URI scheme.
// If this is "ebook" then the URI scheme will be ebook://
#define EBOOK_URI_SCHEME_NAME "ebook"

// relative to location of binary (as specified by argv[0])
#define WEB_EXTENSIONS_RELATIVE_PATH "web_extensions"

#define WEB_APP_RELATIVE_PATH "app/static"
#define WEB_APP_MAIN_FILE "index.html"

char* working_dir_path; // set to dir containing binary by main()

static void initialize_web_extensions(WebKitWebContext *context, gpointer user_data) {
  const gchar* ext_dir;
  GVariant* ext_dir_v = NULL;

  ext_dir = g_build_filename((const gchar*) user_data, WEB_EXTENSIONS_RELATIVE_PATH, NULL);
  
  // create a "Maybe String" type variant
  // https://developer.gnome.org/glib/stable/gvariant-format-strings.html
  ext_dir_v = g_variant_new("ms", (const char*) ext_dir);

  webkit_web_context_set_web_extensions_directory(context, ext_dir);
  webkit_web_context_set_web_extensions_initialization_user_data(context, ext_dir_v);

}

// This runs asynchronously so blocking calls are safe
GBytes* uri_scheme_ebook_load_file(const char* path) {

  GBytes* bytes;
  g_autoptr (GFile) file = NULL;
  
  file = g_file_new_for_path(path);
  
  bytes = g_file_load_bytes(file, NULL, NULL, NULL);
  if(!bytes) {
    // TODO proper error handling
    g_printerr("Error opening %s\n", path);
    return NULL;
  }
  
  return bytes;
}

// This runs asynchronously so blocking calls are safe
GBytes* uri_scheme_ebook_load_file_zip(char* zipfile_path, char* compressed_path) {

  struct zip* z;
  zip_file_t* zf;
  int err;
  char errbuf[200];
  zip_int64_t index;
  struct zip_stat st;
  zip_int64_t bytes_read;
  gpointer buf;
  GBytes* g_buf;
  int ret;

  z = zip_open(zipfile_path, 0, &err);
  if(!z) {
    // TODO show error to user
    zip_error_to_str(errbuf, sizeof(errbuf), err, errno);
    g_printerr("Failed to open zip file %s : %s\n", zipfile_path, errbuf);
    return NULL;
  }

  index = zip_name_locate(z, compressed_path, ZIP_FL_ENC_GUESS);
  if(index < 0) {
    // TODO handle error
    g_printerr("Could not find %s inside of zip archive %s\n", compressed_path, zipfile_path);
    return NULL;
  }

  ret = zip_stat_index(z, index, 0, &st);
  if(ret != 0 || !(st.valid & ZIP_STAT_SIZE)) {
    // TODO handle error
    g_printerr("Failed to get file size of %s inside of zip archive %s\n", compressed_path, zipfile_path);
    return NULL;
  }

  zf = zip_fopen_index(z, index, 0);
  if(!zf) {
    // TODO show error to user
    zip_error_to_str(errbuf, sizeof(errbuf), err, errno);
    g_printerr("Failed to open file from inside zip archive %s//%s: %s\n", zipfile_path, compressed_path, errbuf);
    return NULL;
  }

  buf = g_malloc(st.size);
  if(!buf) {
    g_printerr("Failed to allocate %lu bytes for reading file %s//%s\n", st.size, zipfile_path, compressed_path);
    return NULL;
  }

  bytes_read = zip_fread(zf, buf, st.size);
  if(bytes_read < 0) {
    // TODO show error to user
    zip_error_to_str(errbuf, sizeof(errbuf), err, errno);
    g_printerr("Failed to read file from inside zip archive %s//%s : %s\n", zipfile_path, compressed_path, errbuf);
    goto fail;
  } else if(bytes_read < st.size) {
    // TODO show error to user
    g_printerr("Incomplete read of file from inside zip archive %s//%s\n", zipfile_path, compressed_path);
    goto fail;
  }
  
  if(zip_fclose(zf) < 0) {
    // TODO handle error
    g_printerr("Error closing %s//%s\n", zipfile_path, compressed_path);
    goto fail;
  }

  if(zip_close(z) < 0) {
    // TODO handle error
    g_printerr("Error closing %s\n", zipfile_path);
    goto fail;
  }
  
  g_buf = g_bytes_new_take(buf, st.size);
  return g_buf;

 fail:
  g_free(buf);
  return NULL;
}


// This runs asynchronously so blocking calls are safe
static void uri_scheme_ebook_handler(GTask*        task,
                                     gpointer      unused,
                                     gpointer      task_data,
                                     GCancellable* cancellable) {

  GString* g_uri;
  char* uri;
  size_t uri_len;
  GBytes* ret;
  char* anchor;
  char* zipfile_path;
  char* compressed_path;
  char* web_app_path;

  // This is the data passed with g_task_set_task_data()
  g_uri = (GString*) task_data;
  if(!g_uri) return;

  uri = g_uri_unescape_string(g_uri->str, NULL);
  if(!uri) {
    // TODO handle error
    g_printerr("Unable to unescape URI\n");
    return;
  }

  // strip anchor (if present)
  uri_len = strlen(uri);
  anchor = g_strstr_len(uri, uri_len, "#");
  if(anchor) {
    anchor[0] = '\0'; // terminate string at anchor
    uri_len = strlen(uri);
  }
 
  // If this is a relative path
  if(uri[0] != '/') {
    
    // Load relative files from web app dir
    web_app_path = g_strconcat(working_dir_path, "/", WEB_APP_RELATIVE_PATH, "/", uri, NULL);
    
    ret = uri_scheme_ebook_load_file(web_app_path);    
    // TODO check return value
    
    free(web_app_path);
    
  } else { // this is an absolute path

    zipfile_path = uri;
    
    // Check for the // that separates the epub file path
    // and the path inside of the zip/epub file
    // e.g. /this/is/an/ebook.epub//Chapter1.htm
    compressed_path = g_strstr_len(uri, uri_len, "//");
  
    // if there was no "//" found or it was found at the very end of the string
    if(!compressed_path || (compressed_path - zipfile_path >= uri_len - 2)) {

      // Load the web app instead
      web_app_path = g_strconcat(working_dir_path, "/", WEB_APP_RELATIVE_PATH, "/", WEB_APP_MAIN_FILE, NULL);
      ret = uri_scheme_ebook_load_file(web_app_path);
      // TODO check return value
      free(web_app_path);
    
    } else {

      // change "//" to NULLs, with the first one acting
      // as null terminator for the first part of the string
      compressed_path[0] = '\0';
      compressed_path[1] = '\0';
      // Advance the compressed_path pointer to right after the "//"
      compressed_path += 2;
  
      // TODO check if zipfile_path is a file or directory
      // and check the mimetype
  
      ret = uri_scheme_ebook_load_file_zip(zipfile_path, compressed_path);
    }
  }
  
  g_task_return_pointer(task,
                        ret,
                        g_free);
 cleanup:
  g_free(uri);
}


static void
uri_scheme_book_handler_done(WebKitURISchemeRequest *request,
                             GBytes* bytes)
{
  GInputStream *stream;
    
  // TODO does this make a copy of the data? we should avoid that 
  stream = g_memory_input_stream_new_from_bytes(bytes);
  
  webkit_uri_scheme_request_finish(request, stream, g_bytes_get_size(bytes), "text/html");

  // TODO will the stream already free the bytes? is this a double-free?
  g_bytes_unref(bytes); 
  g_object_unref(stream);
}

// called when async task is done
static void uri_scheme_ebook_handler_callback(void*                  *user_data,
                                              GAsyncResult           *result,
                                              WebKitURISchemeRequest *request) {

  GString *str;
  GBytes* res;

  res = g_task_propagate_pointer(G_TASK(result), NULL);

  if(!res) {
    // TODO
    str = g_string_new ("<html><body>");
    g_string_append_printf(str, "Unknown error");
    g_string_append(str, "</body></html>");
    res = g_bytes_new_take(str->str, str->len);
    g_string_free(str, FALSE);
    uri_scheme_book_handler_done(request, res);
    goto cleanup;
  }

  uri_scheme_book_handler_done(request, res);

 cleanup:
  g_object_unref(request);
}

void uri_scheme_ebook_task_destroy(gpointer data) {
  GString* str = (GString*) data;

  g_string_free(str, TRUE);
}

static gboolean uri_scheme_ebook_callback(WebKitURISchemeRequest *request,
                                          void* user_data)                              
{
  GTask* task;
  const char* path;
  GString* g_path;

  path = webkit_uri_scheme_request_get_uri(request);

  // Remove the initial "ebook://" from the URI.
  // We could use webkit_uri_scheme_request_get_path() instead
  // but unfortunately it looks like that gives a NULL output if
  // the path doesn't begin with a slash.
  // This g_string is freed by uri_scheme_ebook_task_destroy()
  g_path = g_string_new(path);
  g_path = g_string_erase(g_path, 0, sizeof(EBOOK_URI_SCHEME_NAME) + 2);

  task = g_task_new(NULL, NULL,
                    (GAsyncReadyCallback) uri_scheme_ebook_handler_callback,
                    g_object_ref(request));

  // pass the path to the task
  g_task_set_task_data(task, g_path, uri_scheme_ebook_task_destroy);
  
  g_task_run_in_thread(task, uri_scheme_ebook_handler);

  g_object_unref(task);

  return TRUE;
}

// TODO unused
// redirect to the built in web app, passing it the previous URI
int redirect_to_app(WebKitURISchemeRequest *request) {
  g_autofree char* uri;

  // TODO error handling
  
  uri = g_strconcat("app://", "/", NULL);
  webkit_web_view_load_uri(webkit_uri_scheme_request_get_web_view(request), uri);
  
  g_object_unref(request);
  return 0;
}

int register_uri_scheme(WebKitWebContext* web_context) {

  const char foo[] = "test data";
  
  webkit_web_context_register_uri_scheme(web_context,
                                         EBOOK_URI_SCHEME_NAME,
                                         (WebKitURISchemeRequestCallback) uri_scheme_ebook_callback,
                                         (void*) foo, NULL);


  // Don't allow pages in this URI scheme to anything outside of this URI scheme
  webkit_security_manager_register_uri_scheme_as_display_isolated(webkit_web_context_get_security_manager(web_context), EBOOK_URI_SCHEME_NAME);
  
  return 0;
}

/*
int toggle_developer_console(gboolean is_on) {
  
  WebKitSettings *settings = webkit_web_view_get_settings (WEBKIT_WEB_VIEW(w->priv.webview));
  
  g_object_set(G_OBJECT(settings), "enable-developer-extras", is_on, NULL);
  webkit_settings_set_enable_write_console_messages_to_stdout(settings, true);
    
  WebKitWebInspector *inspector = webkit_web_view_get_inspector(WEBKIT_WEB_VIEW(w->priv.webview));
  
  if(is_on == TRUE) {
    webkit_web_inspector_show(WEBKIT_WEB_INSPECTOR(inspector));
  }

}
*/


// Switch the injected CSS style sheet for the web view
// or disable the current injected style sheet if stylesheet is NULL
void switch_user_style_sheet(WebKitWebView* web_view,
                             WebKitUserStyleSheet* stylesheet) {

  WebKitUserContentManager* manager;
  
  manager = webkit_web_view_get_user_content_manager(web_view);
  webkit_user_content_manager_remove_all_style_sheets(manager);
  
  if(stylesheet) {
    webkit_user_content_manager_add_style_sheet(manager, stylesheet);
  }
}

static void webview_destroy_cb(GtkWidget *widget, gpointer arg) {
  gboolean* keep_running = (gboolean*) arg;

  *keep_running = FALSE;
}

int main(int argc, char** argv) {

  GtkWidget *window;
  GtkWidget *scrolled_window;
  GtkWidget* web_view;
  WebKitWebContext* web_context;
  char* path; // path to this binary
  WebKitSettings* settings;
  gboolean ret;
  gboolean keep_running = TRUE;

  // TODO check if argv[0] is set
  
  if(argc < 2) {
    fprintf(stderr, "Usage: %s <url>\n", argv[0]);
    return 1;
  }

  path = realpath(argv[0], NULL);
  working_dir_path = dirname(path);

  ret = gtk_init_check(&argc, &argv);
  if(ret == FALSE) {
    g_printerr("Failed to initialize GTK\n");
    return 1;
  }

  settings = webkit_settings_new();
  webkit_settings_set_enable_developer_extras(settings, TRUE);
  webkit_settings_set_enable_write_console_messages_to_stdout(settings, TRUE);

  web_view = webkit_web_view_new_with_settings(settings);

  web_context = webkit_web_view_get_context(WEBKIT_WEB_VIEW(web_view));

  // Reduce caching to reduce memory usage.
  // We can also switch to WEBKIT_CACHE_MODEL_DOCUMENT_BROWSER
  // if we feel like we have the memory to spare.
  // https://webkitgtk.org/reference/webkit2gtk/stable/WebKitWebContext.html#WebKitCacheModel
  webkit_web_context_set_cache_model(web_context,
                                     WEBKIT_CACHE_MODEL_DOCUMENT_VIEWER);
  
  // TODO check return value
  register_uri_scheme(web_context);
  
  g_signal_connect(web_context,
                   "initialize-web-extensions",
                    G_CALLBACK(initialize_web_extensions),
                   (void*) working_dir_path);
  
  
  window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
  gtk_window_set_default_size(GTK_WINDOW(window), 600, 800);
  gtk_window_set_position(GTK_WINDOW(window), GTK_WIN_POS_CENTER);
  gtk_window_set_resizable(GTK_WINDOW(window), TRUE);

  g_signal_connect(G_OBJECT(window),
                   "destroy",
                   G_CALLBACK(webview_destroy_cb),
                   &keep_running);
  
  scrolled_window = gtk_scrolled_window_new(NULL, NULL);
  gtk_container_add(GTK_CONTAINER(window), scrolled_window);
  gtk_container_add(GTK_CONTAINER(scrolled_window), web_view);


  
  gtk_widget_show_all(window);

  webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view),
                           argv[1]);
  
  while(keep_running) {
    gtk_main_iteration_do(1);
  }
  
  free(path);
  return 0;
}


/*
int main(int argc, const char** argv) {

  WebKitWebContext* web_context;
  char* path; // path to this binary

  // TODO check if argv[0] is set
  
  if(argc < 2) {
    fprintf(stderr, "Usage: %s <url>\n", argv[0]);
    return 1;
  }

  path = realpath(argv[0], NULL);
  working_dir_path = dirname(path);

  // TODO can we really do this before instantiating the web view?
  web_context = webkit_web_context_get_default();

  // Reduce caching to reduce memory usage.
  // We can also switch to WEBKIT_CACHE_MODEL_DOCUMENT_BROWSER
  // if we feel like we have the memory to spare.
  // https://webkitgtk.org/reference/webkit2gtk/stable/WebKitWebContext.html#WebKitCacheModel
  webkit_web_context_set_cache_model(web_context,
                                     WEBKIT_CACHE_MODEL_DOCUMENT_VIEWER);
  
  // TODO check return value
  register_uri_scheme(web_context);
  
  g_signal_connect(web_context,
                   "initialize-web-extensions",
                    G_CALLBACK(initialize_web_extensions),
                   (void*) working_dir_path);
  
  // Open wikipedia in a 800x600 resizable window 
  webview("Webview", argv[1], 800, 600, 1);
  
  free(path);
  return 0;
}

*/

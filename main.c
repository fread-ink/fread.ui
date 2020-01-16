#include <stdlib.h>
#include <libgen.h>
#include <zip.h>
#include <errno.h>
#include "webview.h"

// The name used for the URI scheme.
// If this is "ebook" then the URI scheme will be ebook://
#define EBOOK_URI_SCHEME_NAME "ebook"

// relative to location of binary (as specified by argv[0])
#define WEB_EXTENSIONS_DIR "web_extensions"

static void initialize_web_extensions(WebKitWebContext *context, gpointer user_data) {
  const gchar* ext_dir;
  GVariant* ext_dir_v = NULL;

  ext_dir = g_build_filename((const gchar*) user_data, WEB_EXTENSIONS_DIR, NULL);
  
  // create a "Maybe String" type variant
  // https://developer.gnome.org/glib/stable/gvariant-format-strings.html
  ext_dir_v = g_variant_new("ms", (const char*) ext_dir);

  webkit_web_context_set_web_extensions_directory(context, ext_dir);
  webkit_web_context_set_web_extensions_initialization_user_data(context, ext_dir_v);

}

// This runs asynchronously so blocking calls are safe
GBytes* uri_scheme_ebook_get_data(char* zipfile_path, char* compressed_path) {

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

  GString* g_path;
  GBytes* ret;
  char* zipfile_path;
  char* compressed_path;

  // This is the data passed with g_task_set_task_data()
  g_path = (GString*) task_data;
  if(!g_path) return;

  zipfile_path = g_path->str;
  compressed_path = g_strstr_len(g_path->str, g_path->len, "//");
  // if there was no "//" found or it was found at the very end of the string
  if(!compressed_path || (compressed_path - zipfile_path >= g_path->len - 2)) {
    // TODO imeplement this
    g_printerr("NOT IMPLEMENTED: Passing epub path with no //<compressed_file>\n");
    return;
  }

  // change "//" to NULLs, with the first one acting
  // as null terminator for the first part of the string
  compressed_path[0] = '\0';
  compressed_path[1] = '\0';
  // Advance the compressed_path pointer to right after the "//"
  compressed_path += 2;
  
  // TODO check if zipfile_path is a file or directory
  // and check the mimetype
  
  ret = uri_scheme_ebook_get_data(zipfile_path, compressed_path);
  
  g_task_return_pointer(task,
                        ret,
                        g_free);
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


static void uri_scheme_ebook_handler_callback(void*                  *user_data,
                                              GAsyncResult           *result,
                                              WebKitURISchemeRequest *request) {

  GString *str;
  GBytes* res;

  res = g_task_propagate_pointer(G_TASK(result), NULL);

  if(!res) {
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
  
  if (!g_strcmp0(g_path->str, "foo")) {
    g_print("Foo accessed!\n");
  }

  task = g_task_new(NULL, NULL,
                    (GAsyncReadyCallback) uri_scheme_ebook_handler_callback,
                    g_object_ref(request));

  // pass the path to the task
  g_task_set_task_data(task, g_path, uri_scheme_ebook_task_destroy);
  
  g_task_run_in_thread(task, uri_scheme_ebook_handler);

  g_object_unref(task);

  return TRUE;
}

int register_url_scheme(WebKitWebContext* web_context) {

  const char user_data[] = "test";

  
  webkit_web_context_register_uri_scheme(web_context,
                                         EBOOK_URI_SCHEME_NAME,
                                         (WebKitURISchemeRequestCallback) uri_scheme_ebook_callback,
                                         (void*) user_data, NULL);

  webkit_security_manager_register_uri_scheme_as_no_access(webkit_web_context_get_security_manager(web_context),
                                                           EBOOK_URI_SCHEME_NAME);


  return 0;
}


int main(int argc, const char** argv) {

  WebKitWebContext* web_context;
  char* path; // path to this binary
  char* dir_path; // working dir

  // TODO check if argv[0] is set
  
  if(argc < 2) {
    fprintf(stderr, "Usage: %s <url>\n", argv[0]);
    return 1;
  }

  path = realpath(argv[0], NULL);
  dir_path = dirname(path);

  web_context = webkit_web_context_get_default();

  // TODO check return value
  register_url_scheme(web_context);
  
  g_signal_connect(web_context,
                   "initialize-web-extensions",
                    G_CALLBACK(initialize_web_extensions),
                   (void*) dir_path);
  
  /* Open wikipedia in a 800x600 resizable window */
  webview("Webview", argv[1], 800, 600, 1);
  
  free(path);
  return 0;
}

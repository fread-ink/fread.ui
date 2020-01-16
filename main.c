#include <stdlib.h>
#include <libgen.h>
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

char* uri_scheme_ebook_get_data(char* path) {

  GString *str = g_string_new("");
  
  g_string_append_printf(str, "42");

  // free g_string metadata and return plain char* pointer
  return g_string_free(str, FALSE);
}


// this runs asynchronously
static void uri_scheme_ebook_handler(GTask*        task,
                                     gpointer      data,
                                     gpointer      task_data,
                                     GCancellable* cancellable) {

  GString* g_path;
  
  g_path = (GString*) g_task_get_task_data(task);

  g_print("Path task: %s\n", g_path->str);
  
  g_task_return_pointer(task,
                        uri_scheme_ebook_get_data("/some/path"),
                        g_free);
  
}


static void
uri_scheme_book_handler_done(WebKitURISchemeRequest *request,
                             gchar                  *data,
                             gssize                  data_length)
{
  GInputStream *stream;
  
  data_length = data_length != -1 ? data_length : (gssize) strlen (data);
  stream = g_memory_input_stream_new_from_data(data, data_length, g_free);
  
  webkit_uri_scheme_request_finish(request, stream, data_length, "text/html");
  
  g_object_unref(stream);
}


static void uri_scheme_ebook_handler_callback(void*                  *user_data,
                                              GAsyncResult           *result,
                                              WebKitURISchemeRequest *request) {

  char *res;

  res = g_task_propagate_pointer(G_TASK(result), NULL);

  GString *data_str;
  
  data_str = g_string_new ("<html><body>");

  if(res) {
    g_string_append_printf(data_str, "%s", res);
  }

  g_string_append(data_str, "</body></html>");

  uri_scheme_book_handler_done(request, g_string_free(data_str, FALSE), data_str->len);

  
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

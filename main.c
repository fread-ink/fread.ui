#include <stdlib.h>
#include <libgen.h>
#include "webview.h"

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

int main(int argc, const char** argv) {

  char* path; // path to this binary
  char* dir_path; // working dir

  // TODO check if argv[0] is set
  
  if(argc < 2) {
    fprintf(stderr, "Usage: %s <url>\n", argv[0]);
    return 1;
  }

  path = realpath(argv[0], NULL);
  dir_path = dirname(path);
  
  g_signal_connect(webkit_web_context_get_default(),
                   "initialize-web-extensions",
                    G_CALLBACK(initialize_web_extensions),
                   (void*) dir_path);
  
  /* Open wikipedia in a 800x600 resizable window */
  webview("Webview", argv[1], 800, 600, 1);
  
  free(path);
  return 0;
}

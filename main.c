#include "webview.h"

#define WEB_EXTENSIONS_DIRECTORY "/home/juul/projects/fread/webkit/webview/web_extensions"

static void initialize_web_extensions(WebKitWebContext *context, gpointer user_data) {
  /* Web Extensions get a different ID for each Web Process */
  static guint32 unique_id = 0;

  printf("Initialize web extension\n");
  
  webkit_web_context_set_web_extensions_directory(context, WEB_EXTENSIONS_DIRECTORY);
  webkit_web_context_set_web_extensions_initialization_user_data(context, g_variant_new_uint32(unique_id++));
  
}

int main(int argc, char** argv) {

  g_signal_connect(webkit_web_context_get_default(),
                   "initialize-web-extensions",
                    G_CALLBACK(initialize_web_extensions),
                    NULL);

  if(argc < 2) {
    fprintf(stderr, "Usage: %s <url>\n", argv[0]);
    return 1;
  }
  
  /* Open wikipedia in a 800x600 resizable window */
  webview("Webview", argv[1], 800, 600, 1);
  return 0;
}


// https://cpp.hotexamples.com/site/file?hash=0x0a4695a29d6bc3cc7b9973e94f0661ee7e51fd4f1308b88cb5a6cc2f3aa2291c&fullName=main.c&project=macrat/rusk
// https://webkitgtk.org/reference/webkit2gtk/stable/WebKitWebInspector.html
// https://wiki.gnome.org/Projects/WebKitGtk/ProgrammingGuide/Cookbook
// https://lists.webkit.org/pipermail/webkit-wpe/2019-June/000183.html
// https://webkitgtk.org/reference/jsc-glib/unstable/index.html
// https://gist.github.com/mobius/1759816
//
// The epiphany built-in extension seems to be the only available example of the new API.

#include <stdio.h>
#include <errno.h>
#include <glib-object.h>
#include <webkit2/webkit-web-extension.h>
#include <JavaScriptCore/JavaScript.h>
#include <zip.h>
#include <magic.h>

// relative to ./web_extensions/ dir
// which is relative to the argv[0] path
#define JS_FILE_PATH "fread.js"

void js_console_error(JSCContext *context, const char* msg) {

  g_autoptr (JSCValue) js_console = NULL;
  g_autoptr (JSCValue) js_value = NULL;
  
  js_console = jsc_context_get_value(context, "console");
  js_value = jsc_value_object_invoke_method(js_console, "error", G_TYPE_STRING, msg, G_TYPE_NONE);

}
// exception handler that simply prints
// the exception using console.error()
// and also using g_warning()
static void
js_exception_handler(JSCContext   *context,
                      JSCException *exception)
{
  g_autoptr (JSCValue) js_console = NULL;
  g_autoptr (JSCValue) js_value = NULL;
  g_autofree char *report = NULL;

  js_console = jsc_context_get_value(context, "console");
  js_value = jsc_value_object_invoke_method(js_console, "error", JSC_TYPE_EXCEPTION, exception, G_TYPE_NONE);
  
  report = jsc_exception_report(exception);
  g_warning("%s", report);

  jsc_context_throw_exception(context, exception);
}

static void
web_page_created_callback(WebKitWebExtension *extension,
                          WebKitWebPage      *web_page,
                          gpointer            user_data)
{

  WebKitFrame* frame;
  JSCContext* globalContext;
  
  frame = webkit_web_page_get_main_frame (web_page);
  globalContext = webkit_frame_get_js_context(frame);
  
  
  g_print ("Page %lu created for %s\n", 
	   webkit_web_page_get_id (web_page),
	   webkit_web_page_get_uri (web_page));

}

// return js array with names of all entries in specified directory
// TODO test what happens with invalid path, access denied, etc.
JSCValue* js_ls(const char* path, JSCContext* js_context) {
  GDir* dir = NULL;
  const gchar* entry;
  GPtrArray* garray;
  JSCValue* entry_js;
  JSCValue* ret = NULL;

  dir = g_dir_open(path, 0, NULL);
  if(!dir) {
    // TODO return error to js caller
    g_printerr("Failed to open directory: %s\n", path);
    return NULL;
  }

  garray = g_ptr_array_new();

  do {
    entry = g_dir_read_name(dir);
    if(!entry) {
      break;
    }
    
    entry_js = jsc_value_new_string(js_context, entry);
      
    g_ptr_array_add(garray, entry_js);
    
  } while(entry);
  
  if(errno != EAGAIN) {
    // TODO return error to js caller
    g_printerr("Failed to list contents of directory: %s\n", path);
    goto cleanup;
  }

  ret = jsc_value_new_array_from_garray(js_context, garray);
  
 cleanup:
  // g_dir_close unallocates all the directory entry strings as well
  g_dir_close(dir);
  g_ptr_array_free(garray, FALSE);

  return ret;
}

// use libmagic to get mimetype of file
JSCValue* js_get_mimetype(const char* path, JSCContext* js_context) {
  int ret;
  magic_t cookie;
  const char* mimetype;
  JSCValue* ret_js;

  if(!path) {
    // TODO raise js error 
    return NULL;
  }
  
  cookie = magic_open(MAGIC_MIME_TYPE);
  if(!cookie) {
    // TODO raise js error
    g_printerr("_get_mimetype open failed: %s\n", magic_error(cookie));
    return NULL; 
  }
  
  ret = magic_load(cookie, NULL); // load default magic database
  if(ret != 0) {
    // TODO raise js error
    g_printerr("_get_mimetype load failed: %s\n", magic_error(cookie));
    return NULL; 
  }

  mimetype = magic_file(cookie, path);
  if(!mimetype) {
    // TODO raise js error
    g_printerr("_get_mimetype file read failed: %s\n", magic_error(cookie));
    return NULL;
  }
  
  ret_js = jsc_value_new_string(js_context, mimetype);

  return ret_js;
}


// return js array with names of all entries in zip file
// TODO test what happens with invalid path, access denied, etc.
JSCValue* js_zip_ls(const char* path, JSCContext* js_context) {
  GDir* dir = NULL;
  GPtrArray* garray;
  JSCValue* entry_js;
  JSCValue* js_ret = NULL;
  struct zip* z;
  int err;
  char errbuf[200];
  zip_int64_t num_entries;
  struct zip_stat st;
  int ret;
  zip_uint64_t i;

  z = zip_open(path, 0, &err);
  if(!z) {
    // TODO return error to js caller
    zip_error_to_str(errbuf, sizeof(errbuf), err, errno);
    g_printerr("Failed to open zip file %s : %s\n", path, errbuf);
    return NULL;
  }

  num_entries = zip_get_num_entries(z, 0);
  
  garray = g_ptr_array_new();
  
  for(i=0; i < num_entries; i++) {

    ret = zip_stat_index(z, i, ZIP_FL_ENC_GUESS, &st);
    // skip entries that fail to stat or don't have a valid name and size
    if(ret != 0 || !(st.valid & (ZIP_STAT_NAME | ZIP_STAT_SIZE))) {
      continue;
    }

    // TODO add file sizes
    entry_js = jsc_value_new_string(js_context, st.name);
      
    g_ptr_array_add(garray, entry_js);
    
  }
  
  js_ret = jsc_value_new_array_from_garray(js_context, garray);
  
 cleanup:
  g_ptr_array_free(garray, FALSE);
  ret = zip_close(z);
  if(ret !=0) {
    // TODO handle this error
  }

  return js_ret;
}

static void js_print (const char *msg) {
  g_print("%s\n", msg);
}

static void
window_object_cleared_cb(WebKitScriptWorld       *world,
                         WebKitWebPage           *page,
                         WebKitFrame             *frame,
                         void* ptr)
{
  JSCContext* js_context;

  // about g_autoptr: https://blogs.gnome.org/desrt/2015/01/30/g_autoptr/
  g_autoptr (JSCValue) js_fread = NULL;
  g_autoptr (JSCValue) js_func = NULL;
  g_autoptr (JSCValue) result = NULL;
  g_autoptr (GFile) file = NULL;
  g_autoptr (GBytes) bytes = NULL;
  const char* data;
  gsize data_size;
  const gchar* ext_path;
  const gchar* js_file_path;

  ext_path = (const gchar*) ptr;

  js_context = webkit_frame_get_js_context_for_script_world(frame, world);

  // define an exception handler for all exceptions that occur in js_context
  jsc_context_push_exception_handler(js_context, (JSCExceptionHandler) js_exception_handler, NULL, NULL);

  js_file_path = g_build_filename((const gchar*) ext_path, JS_FILE_PATH, NULL);
  
  // open the fread.js file which contains the javascript code for this extension
  file = g_file_new_for_path(js_file_path);
  // TODO maybe switch this to async IO?
  bytes = g_file_load_bytes(file, NULL, NULL, NULL);
  if(!bytes) {
    g_printerr("Error opening %s\n", js_file_path);
    js_console_error(js_context, "Error opening the extension's js file");
    return;
  }
  data = (const char*) g_bytes_get_data(bytes, &data_size);
  result = jsc_context_evaluate_with_source_uri(js_context, data, data_size, "resource:///org/fread/fread-extension/js/fread.js", 1);
  
  // get the Fread global js object
  // as defined in the fread.js file
  js_fread = jsc_context_get_value(js_context, "Fread");
  
  // define js function `_foo` on Fread object
  js_func = jsc_value_new_function(js_context,
                                 "print",
                                 G_CALLBACK(js_print),
                                 NULL,
                                 NULL,
                                 G_TYPE_NONE,
                                 1,
                                 G_TYPE_STRING);
  jsc_value_object_set_property(js_fread, "print", js_func);
  g_clear_object(&js_func);
  
  // define js function `_ls` on Fread object
  js_func = jsc_value_new_function(js_context,
                                 "_ls",
                                 G_CALLBACK(js_ls),
                                 js_context,
                                 NULL,
                                 JSC_TYPE_VALUE, // return type
                                 1,
                                 G_TYPE_STRING);
  jsc_value_object_set_property(js_fread, "_ls", js_func);
  g_clear_object(&js_func);

  // define js function `_zip_ls` on Fread object
  js_func = jsc_value_new_function(js_context,
                                 "_zip_ls",
                                 G_CALLBACK(js_zip_ls),
                                 js_context,
                                 NULL,
                                 JSC_TYPE_VALUE, // return type
                                 1,
                                 G_TYPE_STRING);
  jsc_value_object_set_property(js_fread, "_zip_ls", js_func);
  g_clear_object(&js_func);

  // define js function `_get_mimetype` on Fread object
  js_func = jsc_value_new_function(js_context,
                                 "_get_mimetype",
                                 G_CALLBACK(js_get_mimetype),
                                 js_context,
                                 NULL,
                                 JSC_TYPE_VALUE, // return type
                                 1,
                                 G_TYPE_STRING);
  jsc_value_object_set_property(js_fread, "_get_mimetype", js_func);
  g_clear_object(&js_func);
  
}



G_MODULE_EXPORT void
webkit_web_extension_initialize_with_user_data(WebKitWebExtension *extension,
                                                GVariant          *user_data) {

  WebKitScriptWorld *script_world;
  const gchar* path;
  
  // TODO does g_variant_get_string malloc for us? it seems like it
  g_variant_get(user_data, "ms", &path);
  g_print("Extension running from path: %s\n", path);
  
  script_world = webkit_script_world_get_default();
  
  g_signal_connect(script_world,
                   "window-object-cleared",
                   G_CALLBACK (window_object_cleared_cb),
                   (void*) path);
  
  g_signal_connect(extension, "page-created", 
                   G_CALLBACK (web_page_created_callback), 
                   NULL);

}

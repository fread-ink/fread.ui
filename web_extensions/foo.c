
// https://webkitgtk.org/reference/jsc-glib/unstable/index.html
// https://lists.webkit.org/pipermail/webkit-wpe/2019-June/000183.html
// https://webkitgtk.org/reference/jsc-glib/unstable/index.html

/*
The epiphany built-in extension seems to be the only available example of the new API.

*/

#include <stdio.h>
#include <glib-object.h>
#include <webkit2/webkit-web-extension.h>
#include <JavaScriptCore/JavaScript.h>

#define JS_FILE_PATH "/home/juul/projects/fread/webkit/webview/web_extensions/fread.js"

JSValueRef ObjectCallAsFunctionCallback(JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {

  printf("Hello World");
  return JSValueMakeUndefined(ctx);
}


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
web_page_created_callback (WebKitWebExtension *extension,
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

  /*
  JSObjectRef globalObject = JSContextGetGlobalObject(globalContext);
    
  JSStringRef logFunctionName = JSStringCreateWithUTF8CString("log");
  JSObjectRef functionObject = JSObjectMakeFunctionWithCallback(globalContext, logFunctionName, &ObjectCallAsFunctionCallback);
        
  JSObjectSetProperty(globalContext, globalObject, logFunctionName, functionObject, kJSPropertyAttributeNone, NULL);
    
  JSStringRef logCallStatement = JSStringCreateWithUTF8CString("log()");
    
  JSEvaluateScript(globalContext, logCallStatement, NULL, NULL, 1, NULL);
    
    
  JSStringRelease(logFunctionName);
  JSStringRelease(logCallStatement);
  */
}

static void js_foo (const char *msg) {
  g_print("Foo said: %s\n", msg);
}

static void
window_object_cleared_cb(WebKitScriptWorld       *world,
                         WebKitWebPage           *page,
                         WebKitFrame             *frame,
                         void* ptr)
{
  JSCContext* js_context;

  printf("AAAAAAAAAAAAAAAA b\n");
  
  // about g_autoptr: https://blogs.gnome.org/desrt/2015/01/30/g_autoptr/
  g_autoptr (JSCValue) js_fread = NULL;
  g_autoptr (JSCValue) js_func = NULL;
  g_autoptr (JSCValue) result = NULL;
  g_autoptr (GFile) file = NULL;
  g_autoptr (GBytes) bytes = NULL;
  const char* data;
  gsize data_size;
  
  js_context = webkit_frame_get_js_context_for_script_world(frame, world);

  // define an exception handler for all exceptions that occur in js_context
  jsc_context_push_exception_handler(js_context, (JSCExceptionHandler) js_exception_handler, NULL, NULL);

  // open the fread.js file which contains the javascript code for this extension
  file = g_file_new_for_path(JS_FILE_PATH);
  bytes = g_file_load_bytes(file, NULL, NULL, NULL);
  if(!data) {
    g_printerr("Error opening %s\n", JS_FILE_PATH);
    js_console_error(js_context, "Error opening the extension's js file");
    return;
  }
  data = (const char*) g_bytes_get_data(bytes, &data_size);
  result = jsc_context_evaluate_with_source_uri(js_context, data, data_size, "resource:///org/fread/fread-extension/js/fread.js", 1);
  
  // get the Fread global js object
  // as defined in the fread.js file
  js_fread = jsc_context_get_value(js_context, "Fread");
  
  // define function `ls`
  js_func = jsc_value_new_function(js_context,
                                 "foo",
                                 G_CALLBACK(js_foo),
                                 NULL,
                                 NULL,
                                 G_TYPE_NONE, 1,
                                 G_TYPE_STRING);

  jsc_value_object_set_property(js_fread, "ls", js_func);
  g_clear_object(&js_func);
  
}

G_MODULE_EXPORT void
webkit_web_extension_initialize_with_user_data(WebKitWebExtension *extension,
                                                GVariant          *user_data) {

  WebKitScriptWorld *scriptWorld;
  
  scriptWorld = webkit_script_world_get_default();
  
  g_signal_connect(scriptWorld,
                   "window-object-cleared",
                   G_CALLBACK (window_object_cleared_cb),
                   NULL);
  
  g_signal_connect(extension, "page-created", 
                   G_CALLBACK (web_page_created_callback), 
                   NULL);

}

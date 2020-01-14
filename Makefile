


all: main extension

main: main.c webview.h
	gcc main.c -o main -DWEBVIEW_GTK=1 `pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.0`



extension: web_extensions/foo.c
	gcc -shared -fPIC -o web_extensions/libfoo.so web_extensions/foo.c `pkg-config --cflags --libs webkit2gtk-4.0 javascriptcoregtk-4.0`

clean:
	rm -f main web_extension/libfoo.so



all: fread.ui extension

fread.ui: main.c webview.h
	gcc main.c -o fread.ui -DWEBVIEW_GTK=1 `pkg-config --cflags --libs gtk+-3.0 webkit2gtk-4.0 libzip`

extension: web_extensions/fread.c
	gcc -shared -fPIC -o web_extensions/fread.so web_extensions/fread.c `pkg-config --cflags --libs webkit2gtk-4.0 javascriptcoregtk-4.0 libzip` -lmagic

clean:
	rm -f fread.ui web_extension/libfread.so


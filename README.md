
Just some personal experiments with WebKit2GTK / JavasScriptCore and Web Process Extensions.

```
sudo apt install build-essential libwebkit2gtk-4.0-dev libjavascriptcoregtk-4.0-dev libzip-dev libmagic-dev
```

```
make
```

```
./main "https://en.wikipedia.org/"
```

# APIs and manuals

## WebKit2GTK

https://wiki.gnome.org/Projects/WebKitGtk/ProgrammingGuide/Cookbook

## JavasScriptCore (new glib API)

https://webkitgtk.org/reference/jsc-glib/unstable/index.html

Also see the Web Process Extension that ships with the epiphany browser for an example.

## libmagic

`man libmagic`

# ToDo

* Filesystem open html file from inside zip file
* Filesystem read file into js memory from inside zip file (for epub metadata)
* Inject all .js files in extension dir
* JS for dynamically loading and unloading CSS from files
* Command line argument for enabling developer console
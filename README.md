
Just some personal experiments with WebKit2GTK / JavasScriptCore and Web Process Extensions.

```
sudo apt install build-essential libwebkit2gtk-4.0-dev libjavascriptcoregtk-4.0-dev
```

```
make
```

```
./main "https://en.wikipedia.org/"
```

# ToDo

* Filesystem `ls` function
* Filesystem `ls` from inside zip file
* Filesystem open html file from inside zip file
* Filesystem read file into js memory from inside zip file (for epub metadata)
* Inject all .js files in extension dir
* JS for dynamically loading and unloading CSS from files
* Command line argument for enabling developer console
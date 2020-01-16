
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

* [WebKitGtk Cookbook](https://wiki.gnome.org/Projects/WebKitGtk/ProgrammingGuide/Cookbook)

## JavasScriptCore (new glib API)

* [JSC glib API](https://webkitgtk.org/reference/jsc-glib/unstable/index.html)

See also [the Web Process Extension that ships with the epiphany browser](https://salsa.debian.org/gnome-team/epiphany-browser/tree/76c15035f784ca8bc911e9ca7abdd292e894da7a/embed/web-process-extension) for an example.

## libzip

* [libzip API docs](https://libzip.org/documentation/)

## libmagic

Ensure you have `libmagic-dev` installed, then:

```
man libmagic
```

# ToDo

## url scheme handler

It looks like the right way to implement epub reading is to register a URI scheme but unfortunately we can't alter WebKit settings on a per-URI-scheme basis so we will have to switch to a "epub reading mode" when an epub:// URI is accessed. I'm not sure how we'll handle switching back again.

We should register the epub URI scheme as [no access](https://webkitgtk.org/reference/webkit2gtk/stable/WebKitSecurityManager.html#webkit-security-manager-register-uri-scheme-as-no-access).

In epub mode we should disable [enable-javascript-markup](https://webkitgtk.org/reference/webkit2gtk/stable/WebKitSettings.html#WebKitSettings--enable-javascript-markup) but not disable javascript since that would prevent our own javascript for epub parsing from running.

Other stuff to disable in epub mode:

* enable-xss-auditor
* enable-webgl
* enable-webaudio
* enable-resizable-text-areas
* enable-site-specific-quirks
* enable-html5-database
* enable-html5-local-storage
* enable-offline-web-application-cache
* enable-java
* enable-media
* enable-media-stream
* enable-mediasource
* enable-mock-capture-devices
* enable-page-cache (don't cache visited pages in memory)
* enable-accelerated-2d-canvas
* hardware-acceleration-policy: WEBKIT_HARDWARE_ACCELERATION_POLICY_NEVER

Stuff to expose to the user:

* auto-load-images

Enable in dev mode only:

* enable-developer-extras
* enable-write-console-messages-to-stdout

Other interesting settings:

* enable-spatial-navigation (keyboard up-down-left-right navigation)

## Misc

* Load web app from filesystem
* Read file into js memory from inside zip file (for epub metadata)
* Inject all .js files in extension dir
* JS for dynamically loading and unloading CSS from files
* Command line argument for enabling developer console

# Other epub readers

## Foliate

[Foliate](https://github.com/johnfactotum/foliate) is an interesting ebook reader which is entirely (or almost) written in javascript using [Epub.js](https://github.com/futurepress/epub.js/) and the [GJS](https://gitlab.gnome.org/GNOME/gjs) javascript bindings for the GNOME platform libraries. It also uses WebKit2GTK.

When opening a 1.9 MB epub in Foliate the absolute minimal memory usage was 69 MB. When opening a larger epub it's obvious that the entire epub is loaded into memory in a way that isn't just the normal linux aggressive caching of files since this memory usage is listed in the "Dirty" column by `pmap -x`. This probably happens because the way foliate opens epub files (which are zip files) is to not open them. What opens them is Epub.js which runs inside the browser javascript context and unzips the entire file inside of browser memory using the JSZip library.

Foliate uses the python tool [KindleUnpack](https://github.com/kevinhendricks/KindleUnpack) to read Kindle format ebooks.


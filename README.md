
Just some personal experiments with WebKit2GTK / JavasScriptCore and Web Process Extensions.

# Installing dependencies

```
sudo apt install build-essential libwebkit2gtk-4.0-dev libjavascriptcoregtk-4.0-dev libzip-dev libmagic-dev
```

# Building

```
make
```

# Building the web app

Ensure you have a recent node.js (only necessary for building), then:

```
cd app/
npm install
npm run build-css
npm run build
```

For more info on developing the web app see `app/README.md`.

# Running

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

* Get rid of webview.h
* Add configurable keyboard hotkeys for reload, back, forward, home, menu and debug
* Show book front page when web app loads an epub
* Write code to generate thumbnails and database of ebooks (IndexedDB?)
* Change existing js filesystem functions to async

## Book browser

Features:

* Thumbnail view
* List view
* Order by: Title, Author, Filename, Date changed, Date published

Two options here: Implement browsing as URL scheme or implement via js. If implementing via URL scheme then we don't get to use js for anything. Parsing the XML and XHTML metadata would be a lot simpler using js. The solutions is probably to use the custom scheme for accessing files inside of zip files (to avoid passing them through JS land). The custom URL scheme can also handle EPUB CFI.

Browsing process: For each book dir:

* List all files in dir
* Check mimetype using libmagic to filter for files we understand
* Use JS to 
* (or if it's faster just call functions directly from js. do some tests)
* (maybe create a separate URI handler for thumbnail scaledown?)

## url scheme handler

It looks like the right way to implement epub reading is to register a URI scheme but unfortunately we can't alter WebKit settings on a per-URI-scheme basis so we will have to switch to a "epub reading mode" when an epub:// URI is accessed. I'm not sure how we'll handle switching back again.

Example epub URI:

```
ebook:///path/to/my/ebook.epub//Chapter1.html#markup

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

# Memory usage

This app rendering the front page of english wikipedia took 60.2 MB of ram (without counting file-backed memory). As an extra check I installed latest Debian 10.2 x86 netinstall in a virtualbox with 256 MB of ram, then disabled swap and installed `xinit` and `awesome` to get a basic X environment, then ran `startx`. I then compiled and ran the webview example and checked MemAvailable in `/proc/meminfo`. Before running the webview example it was 178.9 and while running the example it was 131.7 MB, so it really was not using more than 47.2 MB of ram. This was all on x86.

We can also disable some features to make libwebkitgtk smaller, e.g `-DENABLE_GEOLOCATION=OFF` though this may only result in fewer dependencies and may not affect non-file-backed memory usage. These options can be found in `Source/cmake/WebKitFeatures.cmake`. We can probably disable the following:


```
    WEBKIT_OPTION_DEFINE(ENABLE_VIDEO "Toggle Video support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_VIDEO_TRACK "Toggle Video Track support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_VIDEO_USES_ELEMENT_FULLSCREEN "Toggle video element fullscreen support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_WEBGL "Toggle WebGL support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_WEB_AUDIO "Toggle Web Audio support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_XSLT "Toggle XSLT support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_3D_TRANSFORMS "Toggle 3D transforms support" PRIVATE ON)
    WEBKIT_OPTION_DEFINE(ENABLE_NETSCAPE_PLUGIN_API "Toggle Netscape Plugin API support" PRIVATE ON)
```

# EPUB support

## mimetype

A file called `mimetype` contains the mimetype as a string: `application/epub+zip`.

## NCX

The NCX file is not required for epub 3.0+ files but may be present in older files.

https://www.opticalauthoring.com/inside-the-epub-format-the-still-useful-ncx-file/

## OPS

Open Publication Structure:

http://idpf.org/epub/20/spec/OPS_2.0.1_draft.htm

https://www.opticalauthoring.com/inside-the-epub-format-the-navigation-file/

## OPF

OPF is the [Open Packaging Format](http://idpf.org/epub/20/spec/OPF_2.0.1_draft.htm) which is an XML format that contains metadata about the epub. There will be a `content.opf` file inside the `.epub`.

Here's some javascript for parsing OPF:

https://github.com/futurepress/epub.js/blob/master/src/packaging.js

## EPUB CFI

A CFI or [Canonical Fragment Identifier](http://idpf.org/epub/linking/cfi/epub-cfi.html#sec-epubcfi-intro) is sorta an extended version of URL anchors (the part after the `#` in a URL) which look like e.g:

```
book.epub#epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/3:10)
```

To navigate, we need to be able to parse these.

Here's some javascript for parsing CFIs:

* [readium](https://github.com/readium/readium-cfi-js/) - Needs jquery but seems like that dependency could easily be removed
* [epub.js](https://github.com/futurepress/epub.js/blob/master/src/epubcfi.js) - Partial implementation


Other resources:

* [Fork of readium CFI](https://github.com/educational-resources-and-services/readium-cfi-js)


# Other formats

There are only really three classes of ebook formats that are worth concerning ourselves with. Formats meant to be reflowed, e.g. EPUB, formats not meant to be reflowed, e.g. PDF, and sets of images, e.g. CBZ. If we can support one of each of these then tools like Calibre can facilitate fairly high quality conversion between most other formats into one of these formats.

Other than EPUB it would be nice to support:

* PDF
* CBZ

Lower priority:

* DjVu
* CBR
* HTML in dir, zip, tar or tar.gz
* TXT
* RTF
* Markdown
* FictionBook
* CHM

Even lower priority:

* Mobipocket
* AZW - Kindle format v7 and lower (slightly modified Mobipocket)
* AZW3 - Kindle format v8
* LIT (similar to CHM)
* [Open eBook](https://en.wikipedia.org/wiki/Open_eBook)
* Kindle Print Replica - Just PDF + some stuff

Looks like we can get XPS support for free from MuPDF (a Microsoft PDF-like format) so why not.

Fairly comprehensive list [here](https://en.wikipedia.org/wiki/Comparison_of_e-book_formats).

## PDF support

Probably using MuPDF is a good idea. We could potentially also enable the WebKit PDF plugin with the `ENABLE_PDFKIT_PLUGIN`.

We should also add PDF reflowing support.

## DjVu support

Use [DjVuLibre](http://djvu.sourceforge.net/doc/index.html) and look at [DjView4](http://djvu.sourceforge.net/djview4.html) for an example implementation.

## CBZ support

We already have unzip support for reading EPUB so we just need a decent 

## CBR

Unfortunately since RAR is a proprietary standard there is no libre software to uncompress newer versions of the RAR format. The [UniquE RAR library](http://www.unrarlib.org/) is GPLv2 and supports up to RAR 2.0 but it looks like nothing that's actually open source supports above RAR 2.0 (we're currently at RAR 5.0).

The Debian package `unrar-free` has a few security patches that are not in the official UniquE RAR source code.

# Other epub readers

## MuPDF

MuPDF actually has EPUB support and can do justification! It allows user-supplied CSS but has very few other options in the app though we should check out its API. One bad thing is that the app loads the entire EPUB file into memory. It  doesn't keep its place in the text when font size is changed. It doesn't render pages so the bottom line of text is often cut off vertically.

MuPDF only has a [partially documented API](https://mupdf.com/docs/api/index.html).

We should probably use this only for its PDF and XPS support.

## Readium

[Readium](https://github.com/readium/readium-js) is an in-browser EPUB reader.

Possibly a good alternative to Epub.js

## Epub.js

[Epub.js](https://github.com/futurepress/epub.js/) is an in-browser EPUB reader.

## Foliate

[Foliate](https://github.com/johnfactotum/foliate) is an interesting ebook reader which is entirely (or almost) written in javascript using [Epub.js](https://github.com/futurepress/epub.js/) and the [GJS](https://gitlab.gnome.org/GNOME/gjs) javascript bindings for the GNOME platform libraries. It also uses WebKit2GTK.

When opening a 1.9 MB epub in Foliate the absolute minimal memory usage was 69 MB. When opening a larger epub it's obvious that the entire epub is loaded into memory in a way that isn't just the normal linux aggressive caching of files since this memory usage is listed in the "Dirty" column by `pmap -x`. This probably happens because the way foliate opens epub files (which are zip files) is to not open them. What opens them is Epub.js which runs inside the browser javascript context and unzips the entire file inside of browser memory using the JSZip library.

Foliate uses the python tool [KindleUnpack](https://github.com/kevinhendricks/KindleUnpack) to read Kindle format ebooks.


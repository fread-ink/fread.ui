
fread.ui is work-in-progress ebook reader, web browser and primary UI for the [fread.ink](https://fread.ink) GNU/Linux distro for e-paper devices.

fread.ui aims to be run well on a system with 256 of total memory while providing all the advanced text rendering options expected of a modern ebook reader (using webkit). To compare, all Kindle models starting with the 3rd generation have 256 MB of ram or more.

So far fread.ui supports no ebook formats with EPUB 3.2 support in progress.

This project is based on WebKit2GTK and JavaScriptCore.

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
./fread.ui "ebook:///path/to/book.epub"
```

# Keyboard shortcuts

* Toggle developer console: F12
* Reload page: ctrl-r
* Navigate back: alt-left
* Navigate forward: alt-right

# Implementation

fread.ui is implemented as a combination of a custom URI scheme, a WebKit Web Process Extension and a minimal web app application that uses preact. This is all on top of WebKit2GTK.

The custom URI scheme allows opening of EPUB files using e.g. `ebook://path/to/my/book.epub` and also allows browsing of the files contained in a zip archive (epub uses zip) using the syntax `ebook://path/to/my/book.epub//internal/zip/archive/file.htm`. 

The Web Process Extension adds a global `Fread` javascript object which allows calling a set of C functions from javascript. Currently these add filesystem utility functions such as `Fread.zip_ls` which lists the files in a zip file residing on the filesystem. In the future this will include functions for updating the electronic paper display. The API can glarked from `web_extensions/fread.js`.

The web app provides parsing of the various EPUB-specific metadata formats and rendering of that metadata into something presentable to the user. It is located in `app/`.

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

* Implement .opf parsing and rendering
* Implement CFI parsing and link following
* Show front page of books
* Pagination
* Configuration file for setting keyboard shortcuts
* Change existing jsc filesystem functions to async
* Add setting to let user enable: process-swap-on-cross-site-navigation-enabled
* Unit testing

## Top menu

* Add/remove bookmark
* Show bookmarks
* Theme (switch css file)
* Font size up/down
* Toggle dark mode (webkit has a built-in dark mode)

## Book browser

Features:

* Write code to generate/refresh thumbnails and database of ebooks (IndexedDB?)
* Thumbnail view
* List view
* Order by: Title, Author, Filename, Date changed, Date published
* Search

## Settings page


## Misc

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

Other interesting settings:

* enable-spatial-navigation (keyboard up-down-left-right navigation)

# Memory usage

Memory usage was tested on the latest Debian 10.2 x86 netinstall in a virtualbox with 256 MB of ram, with disabled swap and `apt install xinit awesome` to get a basic X environment. The main process and two WebKit processes together use around 94 to 144 MB depending on how you measure after starting and loading up the mobile front page of english wikipedia:

```
  PID User     Command                         Swap      USS      PSS      RSS 
 3604 juul     /usr/lib/i386-linux-gnu/web        0    12636    18524    31420 
 3603 juul     /usr/lib/i386-linux-gnu/web        0    47500    58284    77720 
 3596 juul     ./fread.ui https://en.m.wik        0     8332    19186    37932 

Unshared:   66.86 MB
PSS:        93.74 MB
Resident:  143.62 MB
```

The script used to generate the above output is `memory_usage/show_memory_usage.rb`. To run this script you need `apt install ruby smem`. Make sure you're not running any other WebKit-based programs when running that script. The `PSS` field is a measure made by smem that takes into account a proportion of shared library memory usage. Some pie charts for PSS and RSS are provided in `memory_usage/` to further illuminate how memory is used by the system. Keep in mind that you need to add up the `WebKitWebProcess`, `WebKitNetworkProcess` and `fread.ui` in those pie charts.

The pie charts show that 19.2 % of memory (PSS) or 26.4 % (RSS) are used by the fread.ink app, again with the mobile english front page of wikipedia loaded.

Generating the pie charts require `apt install python-matplotlib` and where made using:

```
# for RSS
smem --bar=name -s rss

# for PSS
smem --bar=name -s pss
```

We can disable some features to make libwebkitgtk smaller, e.g `-DENABLE_GEOLOCATION=OFF` though this may only result in fewer dependencies and may not affect non-file-backed memory usage. These options can be found in `Source/cmake/WebKitFeatures.cmake`. We can probably disable the following:


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

## 2.0.1

Specified by the three standards:

* [OPF 2.0.1](http://idpf.org/epub/20/spec/OPF_2.0.1_draft.htm)
* [OPS 2.0.1](http://idpf.org/epub/20/spec/OPS_2.0.1_draft.htm)
* [OCF 2.0.1](http://www.idpf.org/doc_library/epub/OCF_2.0.1_draft.doc)

## 3.0.1

Specified by:

* [EPUB 3.0.1](http://idpf.org/epub/301/spec/epub-overview.html)
* [Publications 3.0.1](http://idpf.org/epub/301/spec/epub-publications.html)
* [Content Documents 3.0.1](http://idpf.org/epub/301/spec/epub-contentdocs.html)
* [OCF 3.0.1](http://idpf.org/epub/301/spec/epub-ocf.html)
* [Media Overlays 3.0.1](http://idpf.org/epub/301/spec/epub-mediaoverlays.html)

Only big difference between 3.0.0 and 3.0.1 is the addition of Fixed Layout Documents which is a non-reflowable type of EPUB document.

## 3.1

Here's a [list of changes from 3.0.1](http://idpf.org/epub/31/spec/epub-changes.html).

The biggest things added are:

* WOFF 2.0 and SFNT font support
* Allows remotely hosted fonts, audio, video and any resource loaded by a script

Script support is optional now though so we can still disable script tag support and manually load fonts, audio and video, but we should probably have a user setting for it with the default being "Ask the user".

## 3.2

* [W3C EPUB 3.2 page](https://www.w3.org/publishing/groups/epub3-cg/

Only finalized in May of 2019.

The [list of changes from 3.0.1](https://www.w3.org/publishing/epub32/epub-changes.html) is odd. From a quick read, apart from some reformatting and rewording, it looks identical to the list of changes from 3.0.1 to 3.1 and why isn't it a list of changes from 3.1 to 3.2?

## mimetype

A file called `mimetype` contains the mimetype as a string: `application/epub+zip`.

## OPS

Open Publication Structure.

There's a [parser in readium](https://github.com/readium/readium-js/tree/master/js/epub-model).

https://www.opticalauthoring.com/inside-the-epub-format-the-navigation-file/

## OPF

OPF is the [Open Packaging Format](http://idpf.org/epub/20/spec/OPF_2.0.1_draft.htm) which is an XML format that contains metadata about the epub. There will be a `content.opf` file inside the `.epub`.

[OPF metadata spec](http://idpf.org/epub/20/spec/OPF_2.0.1_draft.htm#Section2.2). The `<metadata>` tag can contain `<dc:foo>` elements, `<meta>` elements or arbitrary elements. The `dc:` elements may be inside a `<dc-metadata>` sub-element. There can be multiple `<dc:creator>` tags and they can have a `role=` and `file-as=` (which is used when sorting authors alphabetically). All EPUB 2.0 must include the metadata tags: dc:title, dc:identifier and dc:language. EPUB 3 adds `<meta property="dcterms:modified">2011-01-01T12:00:00Z</meta>` as a required field. In EPUB 3.0 the `role=`, `file-as=` etc. properties on creator are specified as:

```
    <dc:creator id="creator">Haruki Murakami</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators" id="role">aut</meta>
    <meta refines="#creator" property="alternate-script" xml:lang="ja">村上 春樹</meta>
    <meta refines="#creator" property="file-as">Murakami, Haruki</meta>
    <meta refines="#creator01" property="display-seq">1</meta>
```

The `display-seq` property specifies author name display sequence and is not present in a `<dc:creator display-seq=?>` version.

`<dc:date>2000-01-01T00:00:00Z</dc:date>` is publication date and not required.

ISBN is stored as `<dc:identifier opf:scheme="ISBN">` so that might be the standard way. 

The `<manifest>` element contains a list of all files in the book. They need `id=`, `href=` and `media-type=` (mimetype) + optional `fallback=<id>` and `fallback-style=<id>`. For 3.0 exactly one manifest `<item>` must be declared as the EPUB Navigation Document using the `properties="navn"` property. Though remember `properties=` can be a space-separated list of properties.

The `<spine>` element contains references to the ids in the `<manifest>` section and simply specifies the reading order. The attribute `toc=`, if it exists, points to the `id` of a `<manifest>` element which is the table of contents NCX file. All EPUB 2.0 files _must_ include an NCX file but reading systems only _should_ support it. The NCX item in manifest cannot have a fallback. Another attribute in 3.0 is `page-progression-direction=` which can be "rtl", "ltr" and "default".

The `<guide>` element may or may not be present and references mayor sections like "cover", "toc" and "bibliography". There is only a short list of [possible section types](http://idpf.org/epub/20/spec/OPF_2.0.1_draft.htm#Section2.6) so it should be easy to support.

Here's some javascript for parsing OPF:

https://github.com/futurepress/epub.js/blob/master/src/packaging.js

## NCX

The NCX file is not required for epub 3.0+ files but must be present in 2.0 files. It provides the table of contents. The `<docTitle>` are obvious `<docAuthor>` and then `<navMap>` is the main table of contents with `<navList>` 

https://www.opticalauthoring.com/inside-the-epub-format-the-still-useful-ncx-file/

## EPUB Navigation Document

* [Specification](http://idpf.org/epub/301/spec/epub-contentdocs.html#sec-xhtml-nav)

This is the EPUB 3.0 replacement for NCX (though both can be present). They are basically an xhtml version of the NCX file.

In the `<body>` there are a set of `<nav epub:type="toc" id="toc">` elements where `epub:type=` is either "toc", "page-list" or "landmarks". The `<nav>` element can contain a single heading tag (h1, h2, h3, h4, h5, h6 or hgroup) and a single `<ol>` tag. If `<nav>` elements contain the `hidden=` property then they must not be displayed (doesn't matter what the attribute value is).

## EPUB-specific CSS

E.g:

```
  -epub-hyphens*
  -epub-line-break
  -epub-text-align-last
  -epub-word-break
  -epub-text-orientation
  -epub-fullsize-kana  
  -epub-text-emphasis
  -epub-text-emphasis-color
  -epub-text-emphasis-position
  -epub-text-emphasis-style
  -epub-text-underline-position
  -epub-text-combine
  -epub-text-combine-horizontal
  -epub-ruby-position 
```

Some of these are actually in normal CSS without the `-epub-` prefix, e.g. `ruby-position`.

## Javascript

If the user wants to turn on javascript (we should keep it default off) we need to provide [this special object](http://idpf.org/epub/301/spec/epub-contentdocs.html#app-epubReadingSystem).

## Footnotes

See https://github.com/koreader/koreader/pull/4440

## MathML

WebKit only has a bit of MathML support.

We could use [MathJax](https://www.mathjax.org/) to render MathML in javascript but the ram usage jumps to 170 MB (PSS) or 280 MB (RSS) when loading the MathJax sample page, which is only rendering a few formulas.

[Lasem](https://wiki.gnome.org/Projects/Lasem) but it's unclear how complete it is. It can render to SVG or PNG so we could just pull MathML html nodes using javascript, pass them to Lasem and take back the SVG or image data and replace in the DOM. It might also be possible to do all this without javascript.

KOReader also does not have MathML support so we can't use the same code.

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
* FictionBook2
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

[Readium.js](https://github.com/readium/readium-js) is an in-browser EPUB reader that can also be installed as a Chromium app.

Possibly a good alternative to Epub.js as a source of epub parsing code.

Doesn't seem to support EPUB 2.0 (no .opf support).

Opening a < 100 kB epub using the Chromium app resulted in the following total memory usage

```
Virtual       22338.96 MB
Resident        834.85 MB
PSS (smem)      406.01 MB
Dirty           275.17 MB
```

## Epub.js

[Epub.js](https://github.com/futurepress/epub.js/) is an in-browser EPUB reader.

## Foliate

[Foliate](https://github.com/johnfactotum/foliate) is an interesting ebook reader which is entirely (or almost) written in javascript using [Epub.js](https://github.com/futurepress/epub.js/) and the [GJS](https://gitlab.gnome.org/GNOME/gjs) javascript bindings for the GNOME platform libraries. It also uses WebKit2GTK.

When opening a < 100 kB epub in Foliate the memory usage after startup is > 240 MB (RSS). When opening a larger epub it's obvious that the entire epub is loaded into memory in a way that isn't just the normal linux aggressive caching. This probably happens because the way foliate opens epub files (which are zip files) is to use Epub.js which runs inside the browser javascript context and unzips the entire file inside of browser memory using the JSZip library.

Foliate uses the python tool [KindleUnpack](https://github.com/kevinhendricks/KindleUnpack) to read Kindle format ebooks.


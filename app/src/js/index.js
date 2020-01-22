import {h, render, Component} from 'preact';
import {hyphenate as formatISBN, validate as validateISBN} from 'beautify-isbn';
import parseLanguage from './parse_language.js';

import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

// TODO actually make use of this
// Used to parse OPF identifiers
// https://www.stison.com/onix/codelists/onix-codelist-5.htm
const onixCodeList5 = {
  1: "Proprietary",
  2: "ISBN-10",
  3: "GTIN-13",
  4: "UPC",
  5: "ISMN-10",
  6: "DOI",
  13: "LCCN",
  14: "GTIN-14",
  15: "ISBN-13",
  17: "Legal deposit number",
  22: "URN",
  23: "OCLC number",
  25: "ISMN-13",
  26: "ISBN-A",
  27: "JP e-code",
  28: "OLCC number",
  29: "JP Magazine ID",
  30: "UPC12+5",
  31: "BNF Control number",
  35: "ARK"
};

// supported cover image mimetypes
const supportedCoverMediaTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml'
];


// Supported cover image file extensions
// and their equivalent media types
const supportedCoverFileTypeConv = {
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'svg': 'image/svg+xml'
};

// Supported cover image file extensions
const supportedCoverFileTypes = Object.keys(supportedCoverFileTypeConv);

class OPF {
  
  // Get all meta tags matching tagName
  getMetas(tagName) {
    // We need to do this complicated stuff because querySelector
    // does not support specifying the xml namespace
    // so if we get a tagName like "foo:bar" we query
    // for all tag names with "bar" and filter for ones
    // actually called "foo:bar"
    const origTagName = tagName;
    const colonIndex = tagName.indexOf(':')
    if(colonIndex >= 0) {
      if(colonIndex >= (tagName.length - 1)) return null
      tagName = tagName.slice(colonIndex + 1);
    }
    
    const els = this.doc.querySelectorAll("package > metadata " + tagName);
    
    if(colonIndex < 0) {
      return els;
    }
    const ret = [];
    var i;
    for(i=0; i < els.length; i++) {
      if(els[i].tagName === origTagName) {
        ret.push(els[i]);
      }
    }
    return ret;
  }

  getMeta(tagName, getTextContent) {
    const els = this.getMetas(tagName);
    if(!els.length) return null;
    if(getTextContent) {
      return els[0].textContent;
    }
    return els[0];
  }

  // Tags can refine previous tags, e.g:
  //
  //   <dc:identifier id="foo" opf:some-prop="florp">txt</dc:identifier>
  //   <meta refines="#foo" property="my-prop" scheme="my:scheme">some-val</meta>
  //   <meta refines="#foo" property="my-prop2" scheme="my:scheme">some-val2</meta>
  //   <meta refines="#foo" property="my-prop3">some-val3</meta>
  //
  // This function finds any tags that refine a previous tag
  // and spits out the integrated data as an object, e.g. for the above:
  // {
  //   "noScheme": {
  //     id: "foo",
  //     opf:some-prop: "florp",
  //     my-prop3: "some-val3"
  //   },
  //   "my:scheme": {
  //     my-prop": "some-val",
  //     my-prop2": "some-val2"
  //   }
  // }
  // If flatten is truthy then instead you'd get:
  // {
  //   id: "foo",
  //   opf:some-prop: "florp",
  //   my-prop3: "some-val3"
  //   my-prop": "some-val",
  //   my-prop2": "some-val2"
  // }
  //
  // If dropSchemes is truthy then the scheme is removed from all keys
  // e.g. 'opf:some-prop' becomes 'some-prop'
  //
  refineMeta(element, flatten, dropSchemes) {
    const schemeStripRegex = new RegExp(/^.+:/);
    
    const attrs = element.getAttributeNames();
    const o = {};
    if(!flatten) {
      o.noScheme = {};
    }
    var i;
    var attr;
    var val;
    var scheme;
    if(flatten) {
      scheme = o;
    } else {
      scheme = o.noScheme;
    }
    for(i=0; i < attrs.length; i++) {
      attr = attrs[i];
      val = element.getAttribute(attr);
      if(dropSchemes) {
        attr = attr.replace(schemeStripRegex, '');
      }
      scheme[attr] = val;
    }
    if(!scheme.id) return o;

    var els = this.doc.querySelectorAll("package > metadata meta[refines=\\#"+scheme.id+"]");
    var el;
    for(i=0; i < els.length; i++) {
      el = els[i];
      if(!flatten) {
        scheme = el.getAttribute('scheme') || 'noScheme';
      }
      attr = el.getAttribute('property');
      if(!attr) continue;
      if(dropSchemes) {
        attr = attr.replace(schemeStripRegex, '');
      }
      if(!flatten) {
        if(!o[scheme]) o[scheme] = {};
        scheme = o[scheme];
      }
      scheme[attr] = el.textContent;
    }
    return o;
  }

  // sort creators by their 'display-seq' property (if any)
  creatorSort(a, b) {
    return (parseInt(a['display-seq']) || 0) - (parseInt(b['display-seq']) || 0);
  }
  
  parseCreators() {
    const creators = {};
    const els = this.getMetas('dc:creator');
    var i, el, creator;
    for(i=0; i < els.length; i++) {
      el = els[i];
      creator = this.refineMeta(el, true, true);
      creator.name = el.textContent;
      if(!creator.role) creator.role = 'unknown';
      if(!creators[creator.role]) creators[creator.role] = [];
      creators[creator.role].push(creator);
    }
    var role;
    for(role in creators) {
      creators[role] = creators[role].sort(this.creatorSort);
    }
    if(creators.unknown && !creators.aut) {
      creators.aut = creators.unknown;
      delete creators.unknown;
    }
    return creators;
  }

  setISBN(o, text) {
    const val = text.replace(/[^\d]+/g, '');
    if(val.length === 10) {
      o['ISBN-10'] = formatISBN(val);
    } else if(val.length === 13) {
      o['ISBN-13'] = formatISBN(val);
    }
  }
  
  // Get the EPUB's UUID
  // and properly formatted ISBN-10 or ISBN-13 (if present)
  // and any other Onix Code List 5 identifiers.
  // 
  // Returns e.g:
  // {
  //   'UUID': '124214214',
  //   'ISBN-10': '0-330-32002-5',
  //   'DOI': '10.1038/nature04586'
  // }
  parseIdentifiers() {
    const numbersOnlyRegex = new RegExp(/[^\d]+/g);
    const isbnRegex = new RegExp(/^isbn/i);
    
    var el = this.doc.querySelector('package');
    if(!el) return {};
    // The <package unqiue-identifier=''> attribute
    // references the id= of a <dc:identifier>
    // containing the actual EPUB UUID.
    // There may also be an identifier containing an ISBN
    const epubID = el.getAttribute('unique-identifier');
    const els = this.getMetas('dc:identifier');
    if(!els.length) return {};
    const o = {};
    var attrs;
    var attr;
    var val;
    var i;
    for(i=0; i < els.length; i++) {
      el = els[i];

      // Parse UUID
      //
      // <dc:identifier id="uuid_id" opf:scheme="uuid">8ad7cb26-947b-4e7f-89e9-40fd8a4e530a</dc:identifier>
      //
      if(epubID && el.getAttribute('id') === epubID) {
        o['UUID'] = el.textContent;
      }

      // Parse URIs
      //
      // <dc:identifier opf:scheme="URI" id="id">http://www.gutenberg.org/ebooks/851</dc:identifier>
      if(el.getAttribute('opf:scheme') === 'URI') {
        if(!o['URIs']) {
          o['URIs'] = [el.textContent];
        } else {
          o['URIs'].push(el.textContent);
        }
      }
      
      // Parse older form of ISBN
      //
      // <dc:identifier opf:scheme="ISBN">0-330-32002-5</dc:identifier>
      //
      val = el.getAttribute('opf:scheme');
      if(val && val.toUpperCase() === 'ISBN') {
        this.setISBN(o, el.textContent);
        continue;
      }

      // Parse any Onix Code List 5 identifiers
      // including ISBN-10 and ISBN-13
      //
      // <dc:identifier id="isbn13">urn:isbn:9780741014559</dc:identifier>
      // <meta refines="#isbn13" 
      //   property="identifier-type" 
      //   scheme="onix:codelist5">15</meta>
      //
      attrs = this.refineMeta(el);
      if(!attrs) continue;
      if(attrs['onix:codelist5']) {
        attr = attrs['onix:codelist5']['identifier-type'];
        if(!attr) continue;
        // look up what type of identifier this is
        attr = onixCodeList5[attr];
        if(!attr) continue;
        o[attr] = el.textContent;
        // Try to format ISBNs nicely
        if(attr === 'ISBN-10' || attr === 'ISBN-13') {
          o[attr] = o[attr].replace(numbersOnlyRegex, '');
          o[attr] = formatISBN(o[attr]);
        }
        continue;
      }

      // Non-standard ISBN format seen in some epubs
      //
      // <dc:identifier id="isbn9781509830718">9781509830718</dc:identifier>
      //
      if(attrs['noScheme'] && attrs['noScheme']['id'] && attrs['noScheme']['id'].match(isbnRegex)) {
        this.setISBN(o, el.textContent);
      }
      
    }

    // Some epubs put the ISBN as the UUID
    // check for this as a last resort
    // but only if it validates as a real ISBN.
    //
    // <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
    // <dc:identifier id="bookid">978-1-4302-6572-6</dc:identifier>
    //
    if(o['UUID'] && !o['ISBN-10'] && !o['ISBN-13']) {
      val = o['UUID'].replace(numbersOnlyRegex, '');
      if(validateISBN(val)) {
        this.setISBN(o, val);
      }
    }
    return o;
  }

  // Check if a <manifest> <item> which is supposed to be a cover image
  // is of a supported cover image media-type (e.g. jpg, png, gif, svg).
  // If no media-type attribute is specified then try to match the file extension.
  isValidCoverImageElement(el) {
    if(!el) return false;
    const mediaType = el.getAttribute('media-type');
    if(!mediaType) {
      const href = el.getAttribute('href');
      if(!href) return false;
      if(href.indexOf('.') < 0) return false;
      const ext = href.replace(/.*\./g, '').toLowerCase()
      if(supportedCoverFileTypes.indexOf(ext) >= 0) {
        return supportedCoverFileTypeConv[ext];
      }
    }
    if(supportedCoverMediaTypes.indexOf(mediaType) >= 0) {
      return mediaType;
    }
    return false;
  }

  // Find the cover image
  // TODO write unit tests
  parseCoverImage() {
    
    var o = {
      path: null,
      mediaType: null
    };
    
    var el;
    
    // Some epubs have an <item properties="cover-image"> where the properties
    // can be a space-separated list
    el = this.doc.querySelector("package > manifest item[properties~=cover-image]");
    
    // Other epubs have a <meta name="cover"> or <meta name="cover-image">
    // that references an <item> id= attribute in the <manifest>
    if(!this.isValidCoverImageElement(el)) {
      el = this.doc.querySelector("package > metadata meta[name=cover-image]");
      if(!this.isValidCoverImageElement(el)) {
        el = this.doc.querySelector("package > metadata meta[name=cover]");
        if(!this.isValidCoverImageElement(el)) {
          const itemID = el.getAttribute('content');
          if(itemID) {
            el = this.doc.querySelector("package > manifest item[id="+itemID+"]");
          }
        }
      }
    }

    // Otherwise look for an <item> with id="cover-image" or id="cover"
    if(!this.isValidCoverImageElement(el)) {
      el = this.doc.querySelector("package > manifest item[id=cover-image]");
      if(!this.isValidCoverImageElement(el)) {
        el = this.doc.querySelector("package > manifest item[id=cover]");
      }
    }

    const mediaType = this.isValidCoverImageElement(el);
    
    // We didn't find a cover image
    if(!mediaType) {
      return o;
    }

    o.path = el.getAttribute('href');
    o.mediaType = mediaType;
    
    return o;
  }

  // Public API below

  // Get an array of the authors names, sorted correctly
  // If `forFiling` is true then use the `file-as=` version
  // of the names if they are present, and if not present
  // convert e.g. "John Doe" to "Doe, John"
  getAuthors(forFiling) {
    if(!this.creators || !this.creators.aut) return [];
    var whitespace = new RegExp(/\s+/);

    var ret = [];
    var i, parts, author;
    for(i=0; i < this.creators.aut.length; i++) {
      author = this.creators.aut[i];
      if(forFiling) {
        if(author['for-filing']) {
          ret.push(author['for-filing']);
        } else {
          parts = author.name.split(whitespace);
          if(parts.length <= 1) {
            ret.push(author.name);
          } else {
            ret.push(parts[parts.length-1] + ', ' + parts.slice(0, parts.length - 1).join(' '));
          }
        }
        continue;
      }
      ret.push(author.name);
    }
    return ret;
  }

  // Will return a properly formatted ISBN if present in the .opf file
  // Will prefer 13-digit ISBN over 10-digit if both are present
  getISBN() {
    return this.identifiers['ISBN-13'] || this.identifiers['ISBN-10']
  }
  
  // Throws an exception if XHTML parsing fails
  constructor(opfStr) {
    var el;

    this.doc = parseXHTML(opfStr);

    // TODO there can be more than one title, e.g:
    /*
      <dc:title id="pub-title">The Hackable City</dc:title>
      <meta refines="#pub-title" property="title-type">main</meta>
      <dc:title id="pub-subtitle">Digital Media and Collaborative City-Making in the Network Society</dc:title>
      <meta refines="#pub-subtitle" property="title-type">subtitle</meta>

      or

                <dc:title id="title">The Outlaw Ocean</dc:title>
                <meta property="title-type" refines="#title">main</meta>
                <meta property="display-seq" refines="#title">1</meta>
                <dc:title id="subtitle">Journeys Across the Last Untamed Frontier</dc:title>
                <meta property="title-type" refines="#subtitle">subtitle</meta>
                <meta property="display-seq" refines="#subtitle">2</meta>

    */
    this.title = this.getMeta('dc:title', true)
    this.description = this.getMeta('dc:description', true)
    console.log("description:", this.description);

    // TODO see the fucked up description in
    // Glass_and_Gardens__Solarpunk_Su_Sarena_Ulibarri.epub
    
    this.publicationDate = this.getMeta('dc:date', true);
    if(this.publicationDate) {
      this.publicationDate = new Date(this.publicationDate);
    }
    console.log("publication date:", this.publicationDate);
    this.publisher = this.getMeta('dc:publisher', true)
    console.log("publisher:", this.publisher);
    this.identifiers = this.parseIdentifiers();
    console.log("IDENTIFIERS:", this.identifiers);
    this.creators = this.parseCreators();
    console.log("Creators:", this.creators);
    console.log("Authors:", this.getAuthors());
    console.log("Authors for filing:", this.getAuthors(true));
    
    const lang = this.getMeta('dc:language', true)
    if(lang) {
      this.language = parseLanguage(lang);
    }
    console.log("Language:", this.language);
    
    this.coverImage = this.parseCoverImage();
    console.log("COVER:", this.coverImage);

    this.copyright = this.getMeta('dc:rights', true);
    console.log("Copyright:", this.copyright);
    
    // TODO get cover (html, not image)
    // TODO get fonts

    // WTF is this? (from fifth sacred thing)
    // we should be able to ignore it since it's not a core media type
    // <item href="OEBPS/page-template.xpgt" id="page" media-type="application/vnd.adobe-page-template+xml"/>

    // TODO subject used as tags
    /*
    <dc:subject>solarpunk</dc:subject>
    <dc:subject>climate change</dc:subject>
    <dc:subject>optimistic science fiction</dc:subject>
    <dc:subject>utopia</dc:subject>
    <dc:subject>future</dc:subject>
    <dc:subject>renewable energies</dc:subject>

    or

    <dc:subject xmlns:dc="http://purl.org/dc/elements/1.1/">COMPUTERS / Programming / General</dc:subject>
    */
    
  }
}


function parseDOM(str, mimetype) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, mimetype);

  // Check for errors according to:
  // see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
  var errs = doc.getElementsByTagName('parsererror');
  if(errs.length) {
    var txt = errs[0].textContent;
    txt = txt.replace(/Below is a rendering.*/i, ''); // remove useless message
    txt = txt.replace(':', ': ').replace(/\s+/, ' '); // improve formatting
    throw new Error("Parsing XML failed: " + txt);
  }

  return doc;
}

function parseXML(str) {
  return parseDOM(str, 'text/xml');
}

function parseXHTML(str) {
  return parseDOM(str, 'application/xhtml+xml');
}

// Returns the path to the Package Document (.opf file)
// for the first representation found in `META-INF/container.xml`
function readContainerXML(filepath, cb) {
  Fread.getFromZip(filepath, 'META-INF/container.xml', false, function(err, str) {
    if(err) return cb(err);

    try {
      var doc = parseXML(str);
    } catch(err) {
      return cb(err);
    }

    var els = doc.querySelectorAll("container > rootfiles > rootfile");
    console.log("rootfiles:", els);
    if(els.length < 1) {
      return cb(new Error("This work appears to have no representations listed in its META-INF/container.xml file"));
    }
    if(els.length > 1) {
      // TODO handle multiple representations
      console.log("Note: This epub has more than one representation but we're only showing the first (default) representation. This is allowed by the epub 3.0.1 standard but we should do better.");
    }

    var el = els[0];
    var opfPath = el.getAttribute('full-path');
    if(!opfPath) {
      return cb(new Error("Failed to find the Package Document (.opf) file path"));
    }

    if(opfPath[0] === '/') {
      opfPath = opfPath.slice(1);
    }

    cb(null, opfPath);
    
  });
}



function readOPF(filepath, path, cb) {
  
  Fread.getFromZip(filepath, path, false, function(err, str) {
    if(err) return cb(err);

    try {
      var opf = new OPF(str);
    } catch(err) {
      return cb(err);
    }
    

    
  });
}

function parseEpub() {

  var filepath = Fread.uriToPath(window.location.href);

//  console.log(filepath);
  
//  var files = Fread.open_epub(filepath);
//  console.log(files);
  
  readContainerXML(filepath, function(err, opfPath) {
    if(err) return console.error(err);

    console.log("OPF path:", opfPath);
    
    readOPF(filepath, opfPath, function(err) {
      if(err) return console.error(err);

      // TODO
      
    });
  });
  

}

function renderAll() {
  var container = document.getElementById('container');
  container.innerHTML = '';

  parseEpub();
  
  render((
    <Root />
  ), container);
}


function init() {

  app.actions = require('./actions/index');
  
  renderAll();
}

init();

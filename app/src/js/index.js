import {h, render, Component} from 'preact';
import {hyphenate as formatISBN} from 'beautify-isbn';
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
  // <dc:identifier id="foo" some-prop="florp">txt</dc:identifier>
  // <meta refines="#foo" property="my-prop" scheme="my:scheme">some-val</meta>
  // <meta refines="#foo" property="my-prop2" scheme="my:scheme">some-val2</meta>
  // <meta refines="#foo" property="my-prop3">some-val3</meta>
  // This finds any tags that refine a previous tag
  // and spits out the integrated data as an object, e.g. for the above:
  // {
  //   "noScheme": {
  //     id: "foo",
  //     some-prop: "florp",
  //     my-prop3: "some-val3"
  //   },
  //   "my:scheme": {
  //     my-prop": "some-val",
  //     my-prop2": "some-val2"
  //   }
  // }
  refineMeta(element) {
    const attrs = element.getAttributeNames();
    const o = {
      noScheme: {}
    };
    var i;
    var attr;
    var scheme = o.noScheme;
    for(i=0; i < attrs.length; i++) {
      attr = attrs[i]
      scheme[attr] = element.getAttribute(attr);
    }
    if(!scheme.id) return o;


    var els = this.doc.querySelectorAll("package > metadata meta[refines=\\#"+scheme.id+"]");
    var el;
    for(i=0; i < els.length; i++) {
      el = els[i];
      scheme = el.getAttribute('scheme') || 'noScheme';
      attr = el.getAttribute('property');
      if(!attr) continue;
      
      if(!o[scheme]) o[scheme] = {};
      scheme = o[scheme];
      scheme[attr] = el.textContent;
    }
    return o;
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

      // Get UUID
      //
      // <dc:identifier id="uuid_id" opf:scheme="uuid">8ad7cb26-947b-4e7f-89e9-40fd8a4e530a</dc:identifier>
      //
      if(epubID && el.getAttribute('id') === epubID) {
        o['UUID'] = el.textContent;
        continue;
      }

      // Parse older form of ISBN
      //
      // <dc:identifier opf:scheme="ISBN">0-330-32002-5</dc:identifier>
      //
      val = el.getAttribute('opf:scheme');
      if(val && val.toUpperCase() === 'ISBN') {
        val = el.textContent.replace(/[^\d]+/g, '');
        if(val.length === 10) {
          o['ISBN-10'] = formatISBN(val);
        } else if(val.length === 13) {
          o['ISBN-13'] = formatISBN(val);
        }
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
          o[attr] = o[attr].replace(/[^\d]+/g, '');
          o[attr] = formatISBN(o[attr]);
        }
        continue;
      }

      // Non-standard ISBN format seen in some epubs
      //
      // <dc:identifier id="isbn9781509830718">9781509830718</dc:identifier>
      //
      if(attrs['noScheme']['id'].match(/^isbn/i)) {
        val = el.textContent.replace(/[^\d]+/g, '');
        if(val.length === 10) {
          o['ISBN-10'] = formatISBN(val);
        } else if(val.length === 13) {
          o['ISBN-13'] = formatISBN(val);
        }
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
  
  parseCreators() {
    var els = this.doc.querySelectorAll("package > metadata dc:creator");
    if(!els.length) return;
  }
  
  constructor(opfStr) {
    var el;

    // could throw an exception
    this.doc = parseXHTML(opfStr);
    
    this.title = this.getMeta('dc:title', true)
    this.identifiers = this.parseIdentifiers();
    console.log("IDs:", this.identifiers);
    
    const lang = this.getMeta('dc:language', true)
    if(lang) {
      this.language = parseLanguage(lang);
    }

    this.coverImage = this.parseCoverImage();
    console.log("COVER:", this.coverImage);
//    this.parseIdentifiers();
//    this.parseTitle();
    

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

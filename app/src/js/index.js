import {h, render, Component} from 'preact';
import parseLanguage from './parse_language.js';

import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

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

  // TODO also figure out how to parse this:
  // (from the EPUB 3.0.1 standard)
  /*
        <dc:identifier 
              id="isbn13">urn:isbn:9780741014559</dc:identifier>
        <meta refines="#isbn13" 
              property="identifier-type" 
              scheme="onix:codelist5">15</meta>
        
        <dc:identifier id="isbn10">0-7410-1455-6</dc:identifier>
        <meta refines="#isbn10" 
              property="identifier-type" 
              scheme="onix:codelist5">2</meta>
  */
  
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
    var i;
    for(i=0; i < els.length; i++) {
      el = els[i];
      if(el.getAttribute('opf:scheme').toUpperCase() === 'ISBN') {
        const isbn = el.textContent.replace(/[^\d]+/, '');
        if(isbn.length === 10) {
          o.isbn10 = isbn;
        } else if(isbn.length === 13) {
          o.isbn13 = isbn;
        }
        continue;
      }
      if(epubID && el.getAttribute('id') === epubID) {
        o.uuid = epubID;
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
      const ext = href.replace(/.*\./, '').toLowerCase()
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

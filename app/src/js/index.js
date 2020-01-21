import {h, render, Component} from 'preact';
import parseLanguage from './parse_language.js';

import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

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

  getMeta(tagName) {
    const els = this.getMetas(tagName);
    if(!els.length) return null;
    return els[0].textContent;
  }
  
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
        o.isbn = el.textContent;
        continue;
      }
      if(epubID && el.getAttribute('id') === epubID) {
        o.uuid = epubID;
      }
    }
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
    
    this.title = this.getMeta('dc:title')
    this.identifiers = this.parseIdentifiers();
    
    const lang = this.getMeta('dc:language')
    if(lang) {
      this.language = parseLanguage(lang);
    }
    console.log("language:", this.language);

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

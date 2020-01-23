import {h, render, Component} from 'preact';
import OPF from './opf.js';
import {parseDOM, parseXML, parseXHTML} from './parse_dom.js';
import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

var baseURI;
function absoluteURI(relativeURI) {
  return baseURI + '//' + relativeURI;
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


function navigateForward() {

}

function navigateBackward() {

}

function navigate(index) {

}


function readOPF(filepath, path, cb) {
  
  Fread.getFromZip(filepath, path, false, function(err, str) {
    if(err) return cb(err);

    try {
      var opf = new OPF(str);
    } catch(err) {
      return cb(err);
    }
    
    cb(null, opf);    
  });
}

function parseEpub(cb) {

  var filepath = Fread.uriToPath(window.location.href);

//  console.log(filepath);
  
//  var files = Fread.open_epub(filepath);
//  console.log(files);
  
  readContainerXML(filepath, function(err, opfPath) {
    if(err) return cb(err);
    
    console.log("OPF path:", opfPath);
    
    readOPF(filepath, opfPath, function(err, opf) {
      if(err) return cb(err);
      
      if(opf.coverPage) {
        window.location = absoluteURI(opf.coverPage);
      } else {
        window.location = absoluteURI(opf.spine.items[0]);
      }
      
    });
  });
  

}

function renderAll() {
  var container = document.getElementById('container');
  container.innerHTML = '';

  parseEpub(function(err) {
    if(err) return console.error(err);
  });
  
  render((
    <Root />
  ), container);
}




function init() {

  app.actions = require('./actions/index');

  baseURI = window.location;
  console.log("baseURI:", baseURI);
  
  renderAll();
}

init();

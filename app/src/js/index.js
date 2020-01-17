import {h, render, Component} from 'preact';

import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

/*
  Examples: http://idpf.org/epub/301/spec/epub-ocf.html#physical-container-zip

  # mimetype
  
  We should check that is contains exactly "application/epub+zip"

  # META-INF/container.xml 

  Can have multiple root elements for multiple versions of the same book but just lusing the first one is allowed.
  Used to find the .opf file (the Package Document) for the book.

  Rootfile element can also contain multiple <link rel="foo" href="bar media-type="" /> 
  Documentation for rel: https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types
  Probably the only ones relevant: stylesheet, author, tag, license

  # META-INF/encryption.xml

  Worth checking for so we know we can't read the file.

  Looks like nothing else in the META-INF/ is useful as of 3.0.1 since the formats of other files such as metadata.xml are not specified.

  # Package document (.opf)

  http://idpf.org/epub/301/spec/epub-publications.html#sec-package-documents
*/

// Returns the path to the Package Document (.opf file)
// for the first representation found in `META-INF/container.xml`
function readContainerXML(filepath, cb) {
  Fread.getFromZip(filepath, 'META-INF/container.xml', false, function(err, str) {
    if(err) return cb(err);


    var parser = new DOMParser();
    var doc = parser.parseFromString(str, 'text/xml');
    // TODO check for parse error
    // see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
    
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

    console.log("OPF content:", str);

    // TODO parse OPF
    
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

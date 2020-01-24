
import { h, render, Component } from 'preact';
//import Router from 'preact-router';
//import { route } from 'preact-router';
//import Main from './Main.js';
import Loading from './Loading.js';
import OPF from '../opf.js';
import {parseDOM, parseXML, parseXHTML} from '..//parse_dom.js';


export default class Root extends Component {

  constructor(props) {
    super();
    
    this.state = {
      status: '',
      uri: '',
      baseuri: props.baseuri
    }

    // tracks which keys are currently pressed
    this.keysDown = {};
    
    this.onkeydownBound = this.onkeydown.bind(this);
    this.onkeyupBound = this.onkeyup.bind(this);
  }
  
  absoluteURI(relativeURI) {
    return this.state.baseuri + '//' + relativeURI;
  }

  readOPF(filepath, path, cb) {
    
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

  // Returns the path to the Package Document (.opf file)
  // for the first representation found in `META-INF/container.xml`
  readContainerXML(filepath, cb) {
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


  
  parseEpub(cb) {

    var filepath = Fread.uriToPath(window.location.href);

    //  console.log(filepath);
    
    //  var files = Fread.open_epub(filepath);
    //  console.log(files);
    
    this.readContainerXML(filepath, function(err, opfPath) {
      if(err) return cb(err);
      
      console.log("OPF path:", opfPath);
      
      this.readOPF(filepath, opfPath, function(err, opf) {
        if(err) return cb(err);

        if(opf.coverPage) {
          this.setState({
//            uri: this.absoluteURI(opf.coverPage)
            uri: this.absoluteURI(opf.spine.items[2])
          });
        } else {
          this.setState({
            uri: opf.spine.items[0]
          });
        }
        
      }.bind(this));
    }.bind(this))  
  }

  // Go to page number relative to current page
  // or absolute page number if isAbs is true.
  // E.g. gotoPage(-1) goes to the previous page
  gotoPage(page, isAbs) {
    // TODO use preact ref API
    const iDiv = document.getElementById('iframe-container');

//    console.log('scroll:', this.iWin.scrollY, iDiv.offsetHeight);
//    this.iDoc.body.style.height = (this.iDoc.body.offsetHeight + iDiv.offsetHeight) + 'px';
    this.iWin.scrollTo(0, this.iWin.scrollY + iDiv.offsetHeight);
    this.hideHalfShownLines()
  }

  onkeydown(e) {

    switch(e.keyCode) {
      
    case 32: // space
    case 39: // right arrow

      if(this.keysDown[e.keyCode]) break;
      this.keysDown[e.keyCode] = true;
      this.gotoPage(1);
      break;
    case 37: // left arrow
      if(this.keysDown[e.keyCode]) break;
      this.keysDown[e.keyCode] = true;
      this.gotoPage(-1);
    }
    
  }

  onkeyup(e) {
    switch(e.keyCode) {
      
    case 32: // space
    case 39: // right arrow
    case 37: // left arrow
      
      if(!this.keysDown[e.keyCode]) break;
      delete this.keysDown[e.keyCode]
    }

  }
  
  
  componentDidMount() {
    this.parseEpub(function(err) {
      if(err) return console.error(err);
    });

    this.iframe = document.getElementById('iframe');
    document.addEventListener('keydown', this.onkeydownBound);
    document.addEventListener('keyup', this.onkeyupBound)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onkeydownBound);
    document.removeEventListener('keyup', this.onkeyupBound);
    if(this.iDoc) {
      this.iDoc.removeEventListener('keyup', this.onkeyupBound);
    }
  }

  onResize() {

    // TODO
    // inject CSS document instead
    // With !important on all of these
    const el = document.getElementById('iframe-container');
//    this.iDoc.body.style.columnWidth = (el.offsetWidth) + 'px';
//    this.iDoc.body.style.height = '100%';
    
    // Get the width of the <body> of the document inside the iframe
    // and resize the iframe to make it fit
    const range = document.createRange();
    range.selectNodeContents(this.iDoc.body);
//    this.iframe.style.width = range.getBoundingClientRect().width + 100 + 'px'
  }

  isPartiallyInView(el) {

    var rect;
    if(el.getBoundingClientRect) {
      rect = el.getBoundingClientRect();

    } else {
      const range = document.createRange();
      range.selectNodeContents(el);
      rect = range.getBoundingClientRect();
    }
    const bottom = document.getElementById('iframe').offsetHeight;

    if(rect.top < bottom && rect.bottom > bottom) {
      console.log("Debug:", bottom, rect.top, rect.bottom, el);
      document.getElementById('debugger').style.height = (rect.top) + 'px';
      return 0;
    } else if(rect.top > bottom) {
      return 1;
    } else {
      return -1
    }
  }

  hideHalfShownLines() {
    const iframe = document.getElementById('iframe')
    var i, cur, found;
    for(i=0; i < 2000; i++) { // TODO find real max
      cur = this.walker.currentNode;
      if(cur.nodeName !== '#text') {
        this.walker.nextNode();
        continue;
      }
      const inView = this.isPartiallyInView(cur);
      if(inView == 0) {
//        console.log("Node:", cur);
        const range = document.createRange();
        range.selectNodeContents(cur);
        var rect;
        var lastTop = -1;

        // TODO what if there is only a single character?
        while(range.startOffset < range.endOffset) {
          rect = range.getBoundingClientRect();

          if(rect.top > (iframe.offsetHeight)) {

            console.log('FOUND!', rect.top, iframe.offsetHeight);


            document.getElementById('bottom-hider').style.height = (iframe.offsetHeight - lastTop + 1) + 'px';
            
            found = true;
            break;
          }
          lastTop = rect.top;
          range.setStart(cur, range.startOffset + 1);
        }
        // If the last line of the text element is the one being cut off
        // then we just use the bottom of the last rect
        if(!found) {
          document.getElementById('bottom-hider').style.height = (iframe.offsetHeight - lastTop + 1) + 'px';
        }

      }
      if(found) break;
      this.walker.nextNode();

      // We went too far
      if(inView == 1) {
        this.walker.previousNode();
        break;
      }
    }
    if(!found) console.log("NOTHING");
  }
  
  iframeLoaded() {
    const iframe = document.getElementById('iframe')
    this.iWin = iframe.contentWindow;
    this.iDoc = iframe.contentDocument;
    this.iDoc.addEventListener('keydown', this.onkeydownBound);
    this.iDoc.addEventListener('keyup', this.onkeyupBound);

    this.walker = this.iDoc.createTreeWalker(this.iDoc, NodeFilter.SHOW_TEXT); 

    this.hideHalfShownLines()
    
    this.onResize();
  }
  
  render(props, state) {

    if(this.state.status == 'LOADING') {
      return (
        <Loading />
      );
    }
    
    return (
      <div id="iframe-container">
        <iframe id="iframe" src={this.state.uri} scrolling="no" onload={this.iframeLoaded.bind(this)}></iframe>
      </div>
    );

  }
}



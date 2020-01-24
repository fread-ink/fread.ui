
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

  iframeLoaded() {
    this.iDoc = document.getElementById('iframe').contentDocument;
    console.log("-----", this.iDoc);
//    this.iDoc.body.style.width = '300px';
    this.iDoc.body.style.columnWidth = '500px';
    
  }



  componentDidMount() {
    this.parseEpub(function(err) {
      if(err) return console.error(err);
    });
  }

  render(props, state) {

    if(this.state.status == 'LOADING') {
      return (
        <Loading />
      );
    }
    
    return (
        <iframe id="iframe" src={this.state.uri} scrolling="no" onload={this.iframeLoaded}></iframe>
    );

  }
}



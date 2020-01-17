
var EBOOK_URI_SCHEME = "ebook";

var Fread = {
  // functions with a `_` prefix are defined in the C code

  pathToURI: function(path) {
    return encodeURI(EBOOK_URI_SCHEME + '://' + path);
  },
  
  uriToPath: function(uri) {
    // the +3 is for the '://' at the end of 'ebook://'
    return decodeURI(uri).slice(EBOOK_URI_SCHEME.length + 3);
  },
  

  // get a file from inside a zip file
  getFromZip(zipFilePath, insidePath, isBinary, cb) {
    var uri = this.pathToURI(zipFilePath + '//' + insidePath)
    var req = new Request(uri);
    console.log("Trying to get:", uri);
    fetch(req).then(function(resp) {
      // When using the custom URI scheme
      // resp.ok is never true and resp.status is always 0
      // TODO figure out how to check for errors
//      if(!resp.ok) {
//        return cb(new Error("Failed to get: " + uri);
//      }
      
      if(isBinary) {
        resp.blob().then(function(blob) {
          cb(null, blob);
        });
      } else {
        resp.text().then(function(text) {
          cb(null, text);
        });
      }

    })
  },
  
  
  update: function(x, y, width, height, updateMethod) {
    // TODO input sanity checking
    
    return this._update(x, y, width, height, updateMethod);
  },
  
  // update a dom element
  updateElement: function(element, updateMethod) {

    // TODO get position and dimensions and called this.update
    
  },

  // TODO should be async
  // list files in path
  ls: function(path) {
    // TODO input sanity checking

    // TODO sort output

    return this._ls(path);
  },


  // TODO should be async
  // list files inside zip file
  zip_ls: function(path) {
    // TODO input sanity checking
    
    // TODO sort output
    
    return this._zip_ls(path);
  },
  

  // TODO should be async
  get_mimetype: function(path) {
    
    return this._get_mimetype(path);
  },

  open_epub: function(path, cb) {
    var mimetype = this.get_mimetype(path);
    if(mimetype !== 'application/epub+zip') {
      return cb(new Error("Mimetype not supported: " + mimetype));
    }

    var files = this.zip_ls(path);

    // TODO parse metadata
    
    return files;
  }
  
  
};

console.log("fread.js loaded");

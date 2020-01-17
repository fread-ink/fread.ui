
var Fread = {

  // functions with a `_` prefix are defined in the C code

  update: function(x, y, width, height, updateMethod) {
    // TODO input sanity checking
    
    return this._update(x, y, width, height, updateMethod);
  },
  
  // update a dom element
  updateElement: function(element, updateMethod) {

    // TODO get position and dimensions and called this.update
    
  },

  // list files in path
  ls: function(path) {
    // TODO input sanity checking

    // TODO sort output

    return this._ls(path);
  },

    
  // list files inside zip file
  zip_ls: function(path) {
    // TODO input sanity checking
    
    // TODO sort output
    
    return this._zip_ls(path);
  },
  
  
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


var Fread = {

  // functions with a `_` prefix are defined in the C code
  //
  // _update: function(x, y, width, height)
  // _ls: function(path)
  //

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

    return this._ls;
  }
  
  
};

console.log("fread.js loaded");

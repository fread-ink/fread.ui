'use strict';

const Paginator = require('ebook-paginator');

// An ebook's spine is an array of html files
// that make up the ebook in reading order

// SpinePaginator uses ebook-paginator to paginate through
// each individual html file of the spine in the correct order

class SpinePaginator {

  constructor(pageElementID, spine, opts) {
    this.opts = opts || {};
    this.spine = spine; // aka the "spine"
    this.spineIndex = undefined;
    this.baseURI = this.opts.baseURI || '';

    this.onLastPage = false; // are we on the last page of the current html file
    this.onFirstPage = false; // are we on the first page of the current html file
    
    this.paginator = new Paginator(pageElementID, opts);
  }

  absoluteURI(relativeURI) {
    return this.baseURI + relativeURI;
  }

  async nextSpineItem() {
    if(this.spineIndex + 1 >= this.spine.length) {
      return false;
    }
    this.spineIndex++;
    return await this.load(this.spineIndex);
  }

  async prevSpineItem() {
    var uri;
    if(this.spineIndex === 0 && this.preSpineURI) {
      uri = this.preSpineURI;
      this.spineIndex = -1;
    } else if(this.spineIndex <= 0) {
      return false;
    }

    this.spineIndex--;
    return await this.load(uri || this.spineIndex);
  }

  // Load an html file and begin paginating
  // The uri can be an actual URI or an index into the spine array
  // If uri is not provided then the first entry in the spine array is assumed
  // If the uri is not in the spine,
  // then it is assumed that the URI is at index -1, so before the entire spine
  async load(uri) {
    if(!uri) uri = 0;;

    // uri is an index into the spine array
    if(typeof uri === 'number') {
      uri = this.spine[uri];
      if(!uri) throw new Error("Invalid URI or spine index");
      
    } else { // uri is a string
      // Find out where in the spine we are
      this.spineIndex = -1;
      var i;
      for(i=0; i < this.spine.length; i++) {
        if(this.spine[i] === uri) {
          this.spineIndex = i;
          break;
        }
      }
      if(this.spineIndex === -1) {
        this.preSpineURI = uri;
      }
    }

    uri = this.absoluteURI(uri);
    
    const ret = await this.paginator.load(uri);
    this.onFirstPage = true;
    if(!ret)  {
      this.onLastPage = true;
    } else {
      this.onLastPage = false;
    }
    return ret;
  }

  async firstPage() {
    const ret = this.paginator.nextPage();
    this.onFirstPage = true;
    if(!ret) {
      this.onLastPage = true;
    } else {
      this.onLastPage = false;
    }
    return ret;
  }

  async nextPage() {
    this.onFirstPage = false;
    if(this.onLastPage) {
      return await this.nextSpineItem();
    }
    const ret = await this.paginator.nextPage();
    if(!ret) {
      this.onLastPage = true;
    } else {
      this.onLastPage = false;      
    }
    return ret;
  }

  async prevPage() {
    if(this.onFirstPage) {
      return await this.prevSpineItem();
    }
    const ret = await this.paginator.prevPage();
    if(!ret) {
      this.onLastPage = true;
      if(ret === undefined) {
        this.onFirstPage = true;
      }
    } else {
      this.onLastPage = false;      
    }
    return ret;
  }  
}

module.exports = SpinePaginator;

import {h, render, Component} from 'preact';

import Root from './components/Root.js';

const EBOOK_URL_SCHEME = "ebook://";

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;


function parseEpub() {
  var filepath = window.location.href.slice(EBOOK_URL_SCHEME.length);

  console.log(filepath);
  
  var files = Fread.open_epub(filepath);
  
  console.log(files);
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

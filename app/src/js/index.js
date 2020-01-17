import {h, render, Component} from 'preact';

import Root from './components/Root.js';

var app = {
  state: 'INIT' // first state. system initializing
};

window.app = app;

function renderAll() {
  var container = document.getElementById('container');
  container.innerHTML = '';
  
  render((
    <Root />
  ), container);
}


function init() {

  app.actions = require('./actions/index');
  
  renderAll();
}

init();

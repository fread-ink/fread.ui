
import { h, render, Component } from 'preact';
import Router from 'preact-router';

export default class Main extends Component {

  constructor(props) {
    super();
    var app = window.app;
    
    this.state = {
      
    };
  }

  render(props) {

    return ((
      <iframe id="iframe" src={props.uri} scrolling="no"></iframe>
    ));
  }
  
}

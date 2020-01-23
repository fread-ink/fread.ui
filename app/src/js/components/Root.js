
import { h, render, Component } from 'preact';
import Router from 'preact-router';
import { route } from 'preact-router';
import Main from './Main.js';
import Loading from './Loading.js';

export default class Root extends Component {

  constructor(props) {
    super();
    var app = window.app;
    
    app.state = {
      status: ''
    }    
  }
  
  componentDidMount() {
    
  }

  render(props, state) {

    if(this.state.status == 'LOADING') {
      return (
        <Loading />
      );
    }
    
    return (
      <Router>
		    <Main path="/" />
	    </Router>
    );

  }
}



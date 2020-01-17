
import { h, render, Component } from 'preact';

var app;

export default class Loading extends Component {

  constructor(props) {
    super(props);
    app = window.app;
  }

  render() {
    return (
      <div class="loading">
        <div class="loading-text">Loading...</div>
      </div>
    );
  }
}

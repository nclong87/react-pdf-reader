import React, { PureComponent } from 'react';

import PdfReader from 'react-pdf-reader';

export default class App extends PureComponent {
  render() {
    return (
      <div>
        <PdfReader
          url="https://cors-anywhere.herokuapp.com/https://www.msully.net/files/inline_slides.pdf"
        />
      </div>
    );
  }
}

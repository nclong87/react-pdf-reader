# react-pdf-reader

> ReactJs component for reading PDF document

[![NPM](https://img.shields.io/npm/v/react-pdf-reader.svg)](https://www.npmjs.com/package/react-pdf-reader) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save react-pdf-reader
```

## Usage

```jsx
import React, { Component } from 'react'

import PdfReader from 'react-pdf-reader'

class Example extends Component {
  render () {
    return (
      <div>
        <PdfReader
          url="https://cors-anywhere.herokuapp.com/https://www.msully.net/files/inline_slides.pdf"
        />
      </div>
    );
  }
}
```

## License

MIT © [nclong87](https://github.com/nclong87)

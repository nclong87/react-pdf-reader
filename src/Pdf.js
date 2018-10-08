/* eslint no-bitwise: 0 */
/* eslint react/no-array-index-key: 0 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { PDFJSStatic } from 'pdfjs-dist';
import PdfPage from './PdfPage';
// import i18n from '../../i18n/i18n';

const PDFJS: PDFJSStatic = require('pdfjs-dist');

const makeCancelable = (promise) => {
  let hasCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(val => (
      hasCanceled ? reject({ pdf: val, isCanceled: true }) : resolve(val)
    ));
    promise.catch(error => (
      hasCanceled ? reject({ isCanceled: true }) : reject(error)
    ));
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled = true;
    },
  };
};

class Pdf extends Component {
  static onDocumentError(err) {
    if (err.isCanceled && err.pdf) {
      err.pdf.destroy();
    }
  }

  // Converts an ArrayBuffer directly to base64, without any intermediate 'convert to string then
  // use window.btoa' step and without risking a blow of the stack. According to [Jon Leightons's]
  // tests, this appears to be a faster approach: http://jsperf.com/encoding-xhr-image-data/5
  // Jon Leighton https://gist.github.com/jonleighton/958841
  static defaultBinaryToBase64(arrayBuffer) {
    // console.log('defaultBinaryToBase64')
    let base64 = '';
    const encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const bytes = new Uint8Array(arrayBuffer);
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;

    let a;
    let b;
    let c;
    let d;
    let chunk;

    // Main loop deals with bytes in chunks of 3
    for (let i = 0; i < mainLength; i += 3) {
      // Combine the three bytes into a single integer
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

      // Use bitmasks to extract 6-bit segments from the triplet
      a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
      b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
      c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
      d = chunk & 63;

      // Convert the raw binary segments to the appropriate ASCII encoding
      base64 = [base64, encodings[a], encodings[b], encodings[c], encodings[d]].join('');
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder === 1) {
      chunk = bytes[mainLength];

      a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

      // Set the 4 least significant bits to zero
      b = (chunk & 3) << 4; // 3   = 2^2 - 1

      base64 = [base64, encodings[a], encodings[b], '=='].join('');
    } else if (byteRemainder === 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

      a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
      b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

      // Set the 2 least significant bits to zero
      c = (chunk & 15) << 2; // 15    = 2^4 - 1

      base64 = [base64, encodings[a], encodings[b], encodings[c], '='].join('');
    }

    return base64;
  }

  constructor(props) {
    // console.log('constructor')
    super(props);
    this.state = {
      isFullscreen: false,
      loadingPercent: 0,
      currentPage: 0,
      totalPage: null,
      pdf: null,
      pdfPages: null,
      totalPageRendered: 0,
    };
    this.currentPosition = 0;
    this.offsetData = [];
    this.onGetPdfRaw = this.onGetPdfRaw.bind(this);
    this.onDocumentComplete = this.onDocumentComplete.bind(this);
    this.getDocument = this.getDocument.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onClickFullScreen = this.onClickFullScreen.bind(this);
    // this.setFirstCanvas = this.setFirstCanvas.bind(this);
    this.onFullScreenChanged = this.onFullScreenChanged.bind(this);
    this.onOffsetChanged = this.onOffsetChanged.bind(this);
    this.handleOnChangeCurrentPage = this.handleOnChangeCurrentPage.bind(this);
  }

  componentWillMount() {
    this.loadPDFDocument(this.props);
  }

  componentDidMount() {
    // console.log('componentDidMount')
    this.holder.addEventListener('scroll', this.onScroll);
    if (this.holder.onfullscreenchange !== undefined) {
      this.holder.onfullscreenchange = this.onFullScreenChanged;
    }
    if (this.holder.onwebkitfullscreenchange !== undefined) {
      this.holder.onwebkitfullscreenchange = this.onFullScreenChanged;
    }
    if (this.holder.onmozfullscreenchange !== undefined) {
      this.holder.onmozfullscreenchange = this.onFullScreenChanged;
    }
    if (this.holder.MSFullscreenChange !== undefined) {
      this.holder.MSFullscreenChange = this.onFullScreenChanged;
    }
  }

  componentWillReceiveProps(props) {
    if (this.props.file !== props.file) {
      this.loadPDFDocument(props);
    }
  }

  componentDidUpdate() {
    this.holder.addEventListener('scroll', this.onScroll);
  }

  componentWillUnmount() {
    // console.log('componentWillUnmount')
    const { pdf } = this.state;
    if (pdf) {
      pdf.destroy();
    }
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
    this.holder.removeEventListener('scroll', this.onScroll);
  }

  onFullScreenChanged() {
    this.setState({
      isFullscreen: !this.state.isFullscreen,
    }, () => {
      this.props.onFullScreenChanged(this.state.isFullscreen);
      setTimeout(() => this.setCurrentPage(), 300);
    });
  }

  onClickFullScreen(isRequestFullscreen) {
    console.log('isRequestFullscreen', isRequestFullscreen);
    if (isRequestFullscreen === true) {
      // go full-screen
      if (this.holder.requestFullscreen) {
        this.holder.requestFullscreen();
      } else if (this.holder.webkitRequestFullscreen) {
        this.holder.webkitRequestFullscreen();
      } else if (this.holder.mozRequestFullScreen) {
        this.holder.mozRequestFullScreen();
      } else if (this.holder.msRequestFullscreen) {
        this.holder.msRequestFullscreen();
      }
      return;
    }

    // exit full screen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  onScroll() {
    // console.log('onScroll');
    if (Math.abs(this.currentPosition - this.holder.scrollTop) >= 100) {
      this.setCurrentPage();
    }
  }

  onOffsetChanged(data) {
    // console.log(data);
    this.offsetData[data.page] = data;
  }

  onGetPdfRaw(pdfRaw) {
    // console.log(`onGetPdfRaw ${pdfRaw}`)
    const { onContentAvailable, onBinaryContentAvailable, binaryToBase64 } = this.props;
    if (typeof onBinaryContentAvailable === 'function') {
      onBinaryContentAvailable(pdfRaw);
    }
    if (typeof onContentAvailable === 'function') {
      let convertBinaryToBase64 = this.defaultBinaryToBase64;
      if (typeof binaryToBase64 === 'function') {
        convertBinaryToBase64 = binaryToBase64;
      }
      onContentAvailable(convertBinaryToBase64(pdfRaw));
    }
  }

  onDocumentComplete(pdf) {
    // console.log(`onDocumentComplete ${pdf}`)
    // console.log(pdf);
    this.setState({
      pdf: pdf,
      pdfPages: null,
      totalPage: pdf.numPages,
      loadingPercent: 100,
      totalPageRendered: 0,
    }, () => {
      this.handleOnChangeCurrentPage(1);
      const pdfPages = [];
      for (let i = 1; i <= pdf.numPages; i += 1) {
        pdf.getPage(i).then((pdfPage) => {
          pdfPages.push(pdfPage);
          if (pdfPages.length === this.state.totalPage) {
            this.setState({ pdfPages: pdfPages.sort((a, b) => a.pageIndex - b.pageIndex) });
          }
        });
      }
    });
    const { onDocumentComplete, onContentAvailable, onBinaryContentAvailable } = this.props;
    if (typeof onDocumentComplete === 'function') {
      onDocumentComplete(pdf.numPages);
    }
    if (typeof onContentAvailable === 'function' || typeof onBinaryContentAvailable === 'function') {
      pdf.getData().then(this.onGetPdfRaw);
    }
  }

  setCurrentPage() {
    // console.log(this.holder.scrollTop);
    this.currentPosition = this.holder.scrollTop;
    // console.log(this.offsetData);
    if (this.offsetData.length === 0) {
      return;
    }
    const currentOffsetBottom = this.currentPosition + this.holder.clientHeight;
    const currentOffset = this.offsetData[this.state.currentPage];
    if (currentOffset.offsetBottom < currentOffsetBottom) {
      // go to next page
      for (let i = this.state.currentPage + 1; i <= this.state.totalPage; i += 1) {
        if (this.offsetData[i] && this.offsetData[i].offsetTop <= currentOffsetBottom && this.offsetData[i].offsetBottom > currentOffsetBottom) {
          this.handleOnChangeCurrentPage(this.offsetData[i].page);
          break;
        }
      }
    } else if (currentOffset.offsetTop > currentOffsetBottom) {
      // go to previous page
      for (let i = this.state.currentPage - 1; i >= 1; i -= 1) {
        if (this.offsetData[i] && this.offsetData[i].offsetTop <= currentOffsetBottom && this.offsetData[i].offsetBottom > currentOffsetBottom) {
          this.handleOnChangeCurrentPage(this.offsetData[i].page);
          break;
        }
      }
    }
  }

  getDocument(filepath) {
    // console.log(`getDocument ${val}`)
    // console.log('Begin read');
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
    this.documentPromise = makeCancelable(PDFJS.getDocument({ url: filepath }, false, null, (progress) => {
      this.setState({
        loadingPercent: (progress.loaded / progress.total) * 100,
      });
    }).promise);
    this.documentPromise
      .promise
      .then(this.onDocumentComplete)
      .catch(this.onDocumentError);
    return this.documentPromise;
  }

  handleOnChangeCurrentPage(currentPage) {
    this.setState({
      currentPage: currentPage,
    }, () => {
      if (this.state.currentPage === this.state.totalPage && this.props.onScrollToEnd !== null) {
        this.props.onScrollToEnd();
      }
    });
  }


  loadByteArray(byteArray) {
    this.getDocument(byteArray);
  }

  loadPDFDocument(props) {
    this.currentPosition = 0;
    this.offsetData = [];
    this.setState({
      loadingPercent: 0,
      currentPage: 0,
      totalPage: null,
      pdf: null,
      pdfPages: null,
      totalPageRendered: 0,
    }, () => {
      if (props.file) {
        if (typeof props.file === 'string') {
          return this.getDocument(props.file);
        }
        // Is a File object
        const reader = new FileReader();
        reader.onloadend = () =>
          this.loadByteArray(new Uint8Array(reader.result));
        reader.readAsArrayBuffer(props.file);
      } else if (props.binaryContent) {
        this.loadByteArray(props.binaryContent);
      } else if (props.content) {
        const bytes = window.atob(props.content);
        const byteLength = bytes.length;
        const byteArray = new Uint8Array(new ArrayBuffer(byteLength));
        for (let index = 0; index < byteLength; index += 1) {
          byteArray[index] = bytes.charCodeAt(index);
        }
        this.loadByteArray(byteArray);
      } else if (props.documentInitParameters) {
        return this.getDocument(props.documentInitParameters);
      }
      this.props.onDocumentError('react-pdf-js works with a file(URL) or (base64)content. At least one needs to be provided!');
      return null;
    });
  }

  renderToolbar() {
    if (this.state.totalPage === null) {
      return null;
    }
    return (
      <div className={`tool-bar-container ${this.state.isFullscreen ? 'fullscreen' : ''}`}>
        <div className="tool-bar">
          <div className="page-info">
            Page {this.state.currentPage} / {this.state.totalPage}
          </div>
          <div className="controls">
            {
              !this.state.isFullscreen ?
                <div style={{ cursor: 'pointer' }} role="button" tabIndex="0" onClick={() => this.onClickFullScreen(true)} title="Open full screen mode">
                  <i className="fa fa-expand"></i>
                </div>
                :
                <div style={{ cursor: 'pointer' }} role="button" tabIndex="0" onClick={() => this.onClickFullScreen(false)} title="Exit full screen mode">
                  <i className="fa fa-compress"></i>
                </div>
            }
          </div>
        </div>

      </div>
    );
  }

  renderLoading() {
    if (!this.props.showLoading) {
      return null;
    }
    let percent = 0;
    let text = '';
    if (this.state.loadingPercent < 100) {
      text = 'Loading';
      percent = this.state.loadingPercent;
    } else if (this.state.totalPageRendered < this.state.totalPage) {
      text = 'Rendering';
      percent = (this.state.totalPageRendered / this.state.totalPage) * 100;
    } else {
      return null;
    }
    return <div className="pdf-loader"><div className="pdf-loading-bar"><div className="pdf-loading-completed" style={{ width: `${percent}%` }}></div>{text}...</div></div>;
  }

  renderPdfPages() {
    const style = this.state.totalPage && this.state.totalPageRendered < this.state.totalPage ? { visibility: 'hidden' } : {};
    return (
      <div style={style}>
        {this.state.pdfPages && this.state.pdfPages.map((pdfPage, index) => (
          <PdfPage
            containerWidth={this.props.contentWidth}
            currentPage={this.state.currentPage}
            isFullscreen={this.state.isFullscreen}
            key={index}
            page={pdfPage.pageIndex + 1}
            pdfPage={pdfPage}
            scale={this.props.scale}
            onOffsetChanged={this.onOffsetChanged}
            showLoading={this.props.showLoading}
            renderCompleted={() => this.setState({ totalPageRendered: this.state.totalPageRendered + 1 })}
          />),
        )}
      </div>
    );
  }

  render() {
    return (
      <div className="pdf-reader-container" style={{ height: this.props.height }}>
        <div className="pdf-pages-container" ref={(el) => { this.holder = el; }} >
          {this.renderLoading()}
          {
            this.state.pdf && this.renderPdfPages()
          }
          {this.renderToolbar()}
        </div>

      </div>
    );
  }
}

Pdf.propTypes = {
  showLoading: PropTypes.bool,
  contentWidth: PropTypes.number.isRequired,
  height: PropTypes.string,
  /* content: PropTypes.string,
  documentInitParameters: PropTypes.shape({
    url: PropTypes.string,
  }),
  binaryContent: PropTypes.shape({
    data: PropTypes.any,
  }), */
  file: PropTypes.string.isRequired, // Could be File object or URL string.
  scale: PropTypes.number,
  onContentAvailable: PropTypes.func,
  onBinaryContentAvailable: PropTypes.func,
  binaryToBase64: PropTypes.func,
  onDocumentComplete: PropTypes.func,
  onFullScreenChanged: PropTypes.func.isRequired,
  onDocumentError: PropTypes.func.isRequired,
  onScrollToEnd: PropTypes.func,
};

Pdf.defaultProps = {
  showLoading: true,
  height: '100vh',
  scale: null,
  onContentAvailable: null,
  onBinaryContentAvailable: null,
  binaryToBase64: null,
  onDocumentComplete: null,
  onScrollToEnd: null,
};

Pdf.displayName = 'react-pdf-js-infinite-slugs';

export default Pdf;

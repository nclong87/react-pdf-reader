import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Pdf from './pdf';
import './pdfReader.less';

class PdfReader extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      contentWidth: null,
      isFullscreen: false,
      isExternalDocument: props.isExternalDocument,
      seen: false,
    };
    this.onDocumentError = this.onDocumentError.bind(this);
    this.handleOnScrollToEnd = this.handleOnScrollToEnd.bind(this);
  }

  componentDidMount() {
    setTimeout(() => {
      if (this.holder) {
        this.setState({
          contentWidth: this.holder.offsetWidth,
        });
      }
    }, 500);
  }

  componentWillReceiveProps(props) {
    if (this.props.url !== props.url) {
      this.setState({
        isExternalDocument: props.isExternalDocument,
      });
    }
  }

  onDocumentError(err) {
    console.log('ERROR', err);
    // Below is magical thing, we switch back to another reading type when load document error
    this.setState({
      isExternalDocument: true,
    });
  }

  getUrlByType() {
    if (this.state.isExternalDocument) {
      return `https://docs.google.com/gview?url=${this.props.url}&embedded=true`;
    }
    return this.props.url;
  }

  handleOnScrollToEnd() {
    if (this.state.seen === true) {
      return;
    }
    this.setState({
      seen: true,
    }, () => {
      if (this.props.onEnded !== null) {
        this.props.onEnded();
      }
    });
  }

  render() {
    const url = this.getUrlByType();
    if (url === '') {
      return null;
    }
    if (this.state.isExternalDocument) {
      return (
        <iframe className="pdf-reader-container" title="PDF reader" frameBorder={0} style={this.props.style} src={url}></iframe>
      );
    }
    return (
      <div style={Object.assign({}, { width: '100%', display: 'block', maxWidth: this.state.contentWidth }, this.props.style)} ref={(el) => { this.holder = el; }}>

        {
          this.state.contentWidth ?
            <Pdf
              onScrollToEnd={this.handleOnScrollToEnd}
              showLoading={this.props.showLoading}
              onDocumentError={this.onDocumentError}
              onFullScreenChanged={isFullscreen => this.setState({ isFullscreen: isFullscreen })}
              contentWidth={this.state.contentWidth}
              height={this.props.height}
              file={url}
              scale={this.props.scale}
            /> : null
        }

      </div>
    );
  }
}

PdfReader.propTypes = {
  isExternalDocument: PropTypes.bool,
  showLoading: PropTypes.bool,
  height: PropTypes.string,
  style: PropTypes.instanceOf(Object),
  url: PropTypes.string.isRequired,
  scale: PropTypes.number,
  onEnded: PropTypes.func,
};

PdfReader.defaultProps = {
  isExternalDocument: false,
  showLoading: true,
  style: {},
  height: '100%',
  scale: null,
  onEnded: null,
};

export default PdfReader;

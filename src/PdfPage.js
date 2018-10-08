import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class PdfPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dataURL: '',
      isRendered: false,
      viewport: null,
    };
    this.onOffsetChanged = this.onOffsetChanged.bind(this);
    // this.renderPage = this.renderPage.bind(this);
  }

  componentWillMount() {
    if (this.props.pdfPage) {
      const scale = this.props.scale === null ? this.props.containerWidth / this.props.pdfPage.getViewport(1.0).width : this.props.scale;
      const viewport = this.props.pdfPage.getViewport(scale);
      this.setState({
        viewport: viewport,
      }, () => {
        this.onOffsetChanged();
        this.renderPage();
      });
    }
  }

  componentWillReceiveProps(props) {
    // console.log(props);
    if (this.props.isFullscreen !== props.isFullscreen) {
      this.onOffsetChanged();
      if (this.props.page === props.currentPage) {
        setTimeout(() => {
          this.canvas.scrollIntoView({ block: 'end', behaviour: 'smooth' });
        }, 300);
      }
    }
    if (this.state.isRendered === false && props.currentPage !== this.props.currentPage) {
      this.renderPage();
    }
  }

  onOffsetChanged() {
    setTimeout(() => {
      const offsetTop = this.canvas.offsetTop;
      this.props.onOffsetChanged({
        page: this.props.page,
        offsetTop: offsetTop,
        offsetBottom: offsetTop + this.canvas.offsetHeight,
      });
    }, 100);
  }

  renderPage() {
    // console.log('renderPage', this.props.page);
    const canvasContext = this.canvas.getContext('2d');
    const viewport = this.state.viewport;
    // viewport.width = 800;
    this.canvas.width = viewport.width;
    if (this.props.scale === null) {
      this.canvas.height = viewport.width > this.props.containerWidth ? ((this.props.containerWidth / viewport.width) * viewport.height) : viewport.height;
    } else {
      this.canvas.height = viewport.height;
    }
    this.props.pdfPage.render({ canvasContext, viewport })
      .then(() => {
        this.setState({
          // dataURL: canvas.toDataURL('image/png'),
          isRendered: true,
        }, () => this.props.renderCompleted());
      });
  }

  renderLoading() {
    if (!this.state.viewport) {
      return null;
    }
    const text = this.props.showLoading === false ? '' : 'Please wait...';
    const width = this.state.viewport.width;
    const height = width > this.props.containerWidth ? ((this.props.containerWidth / width) * this.state.viewport.height) : this.state.viewport.height;
    return <div className="loading" style={{ width: width, height: height }}><span>{text}</span></div>;
  }

  render() {
    /* const width = this.state.viewport.width;
    let maxWidth = this.props.containerWidth;
    if (maxWidth > width) {
      maxWidth = width;
    } */
    return (
      <div className="pdf-page">
        <canvas ref={(el) => { this.canvas = el || this.canvas; }} />
      </div>
    );
  }
}

PdfPage.propTypes = {
  showLoading: PropTypes.bool,
  containerWidth: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  isFullscreen: PropTypes.bool.isRequired,
  page: PropTypes.number.isRequired,
  // scale: PropTypes.number,
  // rotate: PropTypes.number,
  pdfPage: PropTypes.instanceOf(Object).isRequired,
  // setFirstCanvas: PropTypes.func.isRequired,
  // onPageComplete: PropTypes.func.isRequired,
  onOffsetChanged: PropTypes.func.isRequired,
  renderCompleted: PropTypes.func.isRequired,
  scale: PropTypes.number,
};

PdfPage.defaultProps = {
  showLoading: true,
  scale: null,
  // scale: 3,
  // rotate: 0,
};

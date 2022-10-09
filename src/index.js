import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import styles from './styles.css'

class PDF extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      currentPage: 1
    }
    this.totalPages = 0
    this.handleOnReceived = this.handleOnReceived.bind(this)
    this.handlePressEscape = this.handlePressEscape.bind(this)
    this.handleClickOnPopupContainer = this.handleClickOnPopupContainer.bind(this)
    this.goToPage = this.goToPage.bind(this)
    this.requestPresentationMode = this.requestPresentationMode.bind(this)
    this.sendDocumentState = this.sendDocumentState.bind(this)
  }

  componentDidMount() {
    window.addEventListener('message', this.handleOnReceived)
    document.addEventListener('keydown', this.handlePressEscape, false)
  }

  componentDidUpdate(prevProps, prevState) {
    const { currentPage } = this.state
    if (prevState.currentPage !== currentPage) {
      this.props.onPageChanged(currentPage)
    }
    if (prevProps.downloadable !== this.props.downloadable) {
      const resource = {
        downloadable: this.props.downloadable
      }
      const host = this.props.viewer.host
      this.iframe.contentWindow.postMessage({ message: 'onResourceChanged', data: resource }, host)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.handleOnReceived, false)
    document.removeEventListener('keydown', this.handlePressEscape, false)
  }

  goToPage(page) {
    // console.log('goToPage1', page)
    const host = this.props.viewer.host
    this.iframe.contentWindow.postMessage({ message: 'onPageChanged', data: page }, host)
  }

  requestPresentationMode(data) {
    const host = this.props.viewer.host
    this.iframe.contentWindow.postMessage({ message: 'onPresentationModeRequested', data }, host)
  }

  sendDocumentState(data) {
    const host = this.props.viewer.host
    this.iframe.contentWindow.postMessage({ message: 'onStateChanged', data }, host)
  }

  handlePressEscape(e) {
    if (e.keyCode === 27) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault()
      }
      if (typeof e.stopPropagation === 'function') {
        e.stopPropagation()
      }
      this.props.onRequestClose()
    }
  }

  handleClickOnPopupContainer(e) {
    // console.log('handleClickOnPopupContainer', e.target)
    if (e.target.className.indexOf('popupContainer') >= 0) {
      this.props.onRequestClose()
    }
  }

  handleOnReceived(event) {
    const host = this.props.viewer.host
    if (event.origin !== host) {
      return
    }
    if (event.data && event.data.type) {
      // console.log('Received Message : ', event)
      if (!this.iframe) {
        return
      }
      switch (event.data.type) {
        case 'ready': {
          const resource = {
            src: this.props.src,
            popup: this.props.popup,
            downloadable: this.props.downloadable
          }
          this.iframe.contentWindow.postMessage({ message: 'onResourceChanged', data: resource }, host)
          break
        }
        case 'close':
          this.props.onRequestClose()
          break
        case 'documentloaded': {
          const { pagesCount } = event.data.data
          this.totalPages = pagesCount
          break
        }
        case 'pagechanging': {
          const { pageNumber } = event.data.data
          this.setState({ currentPage: pageNumber })
          break
        }
        case 'pagerendered': {
          const { pageNumber } = event.data.data
          if (this.totalPages > 0 && pageNumber === this.totalPages) {
            this.props.onLastPage()
          }
          break
        }
        default:
          break
      }
    }
  }

  renderIframe() {
    const { host, path } = this.props.viewer
    const style = { width: '100%', height: '100%' }
    return (
      <iframe
        ref={el => {
          this.iframe = el
        }}
        className={this.props.popup ? styles.popupiframe : ''}
        frameBorder='0'
        allowFullScreen
        style={style}
        title='PDF Reader'
        src={`${host}${path}`}
      />
    )
  }

  render() {
    if (this.props.popup) {
      return (
        <div
          role='button'
          tabIndex={0}
          className={styles.popupContainer}
          onClick={this.handleClickOnPopupContainer}
        >
          <div className={styles.popupContent}>
            {this.renderIframe()}
          </div>
        </div>
      )
    }
    return this.renderIframe()
  }
}

PDF.propTypes = {
  viewer: PropTypes.instanceOf(Object),
  popup: PropTypes.bool,
  downloadable: PropTypes.bool,
  src: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Object)
  ]).isRequired,
  onPageChanged: PropTypes.func,
  onLastPage: PropTypes.func,
  onRequestClose: PropTypes.func
}

PDF.defaultProps = {
  viewer: {
    host: 'https://nclong87.github.io',
    path: '/web/viewer.html'
  },
  popup: false,
  downloadable: false,
  onPageChanged: () => null,
  onRequestClose: () => null,
  onLastPage: () => null
}

export default PDF
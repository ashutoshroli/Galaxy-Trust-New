import React from 'react';

// Catches render-time errors anywhere in the tree and shows a friendly fallback
// instead of a blank white screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="login-wrap">
          <div className="login-box" style={{ textAlign: 'center' }}>
            <div className="login-logo" aria-hidden="true" />
            <h2><span className="gradient-text">Something went wrong</span></h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              An unexpected error occurred. Please reload the page.
            </p>
            <button style={{ width: '100%' }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

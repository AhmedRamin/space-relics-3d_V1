import { Component } from 'react';

/** Keeps a WebGL/render failure from blanking the whole app. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ui] render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="state" style={{ height: '100vh' }}>
          <h2>WebGL render error</h2>
          <div className="error-box">{this.state.error.message}</div>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

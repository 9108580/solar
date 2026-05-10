import { Component } from 'react';

// Boundary isolated from lucide-heavy App bundle — catches render errors in children.

export class RootBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info: info?.componentStack });
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error);
      return (
        <div
          style={{
            padding: '24px',
            fontFamily: 'system-ui,sans-serif',
            background: '#0f172a',
            color: '#fecaca',
            minHeight: '100vh',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <h1 style={{ color: '#f87171', marginTop: 0 }}>שגיאת טעינה</h1>
          <p style={{ color: '#cbd5e1' }}>פתח קונסולה (F12) או העתק את הטקסט למפתח.</p>
          <pre style={{ color: '#fde68a', fontSize: 13 }}>{msg}</pre>
          {this.state.info ? (
            <pre style={{ color: '#94a3b8', fontSize: 11 }}>{this.state.info}</pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#0F1214', color: '#fff', minHeight: '100vh' }}>
          <h1 style={{ color: '#C9A84C' }}>Oops! Something went wrong.</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 500, margin: '20px auto' }}>
            The application crashed. This is usually due to a missing data property or a network error.
          </p>
          <pre style={{ 
            background: 'rgba(255,255,255,0.05)', 
            padding: 20, 
            borderRadius: 12, 
            textAlign: 'left', 
            display: 'inline-block',
            maxWidth: '90%',
            overflow: 'auto',
            fontSize: 12,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ marginTop: 30 }}>
            <button 
              onClick={() => window.location.href = '/'}
              style={{ background: '#C9A84C', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

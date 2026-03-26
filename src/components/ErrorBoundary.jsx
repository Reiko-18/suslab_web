import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: '#666' }}>An unexpected error occurred. Please try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', backgroundColor: '#7C9070', color: '#fff' }}
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

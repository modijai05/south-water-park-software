import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    // Log error details for debugging
    console.log('Error Stack:', error.stack);
    console.log('Component Stack:', errorInfo.componentStack);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Dispatch error event for global error handling
    window.dispatchEvent(new CustomEvent('react-error', {
      detail: { error, errorInfo, timestamp: new Date().toISOString() }
    }));
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error fallback UI
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '10px' }}>
            🚨 Something went wrong
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '15px' }}>
            The application encountered an unexpected error. Please refresh the page and try again.
          </p>
          <details style={{ 
            textAlign: 'left', 
            backgroundColor: '#fef2f2', 
            padding: '10px', 
            borderRadius: '4px',
            border: '1px solid #fca5a5'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              📋 Error Details (for developers)
            </summary>
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              <div><strong>Error:</strong> {this.state.error?.message}</div>
              <div><strong>Time:</strong> {new Date().toLocaleString()}</div>
              {this.state.error?.stack && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Stack Trace:</strong>
                  <pre style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '10px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: '11px'
                  }}>
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '15px'
            }}
          >
            🔄 Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export default ErrorBoundary;

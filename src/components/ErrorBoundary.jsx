import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[RutaRep] Error no controlado:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0b1320',
            padding: '24px',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: 48 }}>⚠️</div>
          <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16, margin: 0 }}>
            Algo salió mal
          </p>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Ocurrió un error inesperado. Recargá la app para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              background: '#fbbf24',
              color: '#0b1320',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

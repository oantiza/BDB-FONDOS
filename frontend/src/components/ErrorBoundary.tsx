import React from 'react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 border border-red-200 rounded-lg m-4">
                    <span className="text-4xl mb-4">⚠️</span>
                    <h2 className="text-lg font-bold text-red-700 mb-2">Algo salió mal</h2>
                    <p className="text-sm text-red-600 mb-4 text-center max-w-md">
                        {this.state.error?.message || 'Error desconocido'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-bold"
                    >
                        Recargar página
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary

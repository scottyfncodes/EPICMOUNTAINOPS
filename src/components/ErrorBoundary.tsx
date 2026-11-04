import { Component, type ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'

function Fallback({ message }: { message: string }) {
  return (
    <div className="fullstate">
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <div className="row gap-s">
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <a className="btn btn--ghost" href="/">
          Command Center
        </a>
      </div>
    </div>
  )
}

function RouteError() {
  const err = useRouteError() as Error | undefined
  console.error(err)
  return <Fallback message={err?.message || 'Unexpected error.'} />
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  static RouteError = RouteError
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    return this.state.error ? <Fallback message={this.state.error.message} /> : this.props.children
  }
}

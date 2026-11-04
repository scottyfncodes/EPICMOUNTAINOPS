import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="fullstate">
      <Icon name="map" size={28} />
      <h1>Off the map</h1>
      <p>That {what} doesn’t exist — it may have been deleted or renamed.</p>
      <div className="row gap-s">
        <Link className="btn btn--primary" to="/">
          Command Center
        </Link>
        <Link className="btn btn--ghost" to="/search">
          Search
        </Link>
      </div>
    </div>
  )
}

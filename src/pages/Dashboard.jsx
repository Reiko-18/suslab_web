import { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin } from 'lucide-react'
import { edgeFunctions } from '../services/edgeFunctions'
import './Dashboard.css'

function Dashboard() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        const data = await edgeFunctions.getEvents()
        setEvents(data ?? [])
      } catch (err) {
        console.error('Failed to fetch events:', err)
        setError(err.message ?? '無法載入活動')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>活動紀錄</h2>
            <p>社群近期與即將舉辦的活動</p>
          </div>

          {loading ? (
            <div className="loading-grid grid-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card skeleton-card">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text short" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>目前沒有活動</p>
            </div>
          ) : (
            <div className="grid-3">
              {events.map((event) => (
                <div key={event.id} className="card event-card">
                  <div className="event-date-badge">
                    <Calendar size={14} />
                    {event.date}
                  </div>
                  <h3>{event.title}</h3>
                  <p className="event-desc">{event.description}</p>
                  <div className="event-meta">
                    <span>
                      <Clock size={14} />
                      {event.time}
                    </span>
                    <span>
                      <MapPin size={14} />
                      {event.location}
                    </span>
                    <span>
                      <Users size={14} />
                      {event.attendees} 人參加
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard

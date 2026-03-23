import { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin } from 'lucide-react'
import { supabase } from '../services/supabaseClient'
import './Dashboard.css'

const PLACEHOLDER_EVENTS = [
  {
    id: 1,
    title: '永續生活讀書會',
    description: '一起閱讀《我們可以選擇的未來》並分享心得。',
    date: '2026-04-05',
    time: '19:00',
    location: 'Discord 語音頻道',
    attendees: 18,
  },
  {
    id: 2,
    title: '零廢棄工作坊',
    description: '學習日常生活中的零廢棄實踐方法。',
    date: '2026-04-12',
    time: '14:00',
    location: 'Discord 語音頻道',
    attendees: 24,
  },
  {
    id: 3,
    title: '社群月會',
    description: '回顧本月活動、討論下月規劃、歡迎新成員。',
    date: '2026-04-20',
    time: '20:00',
    location: 'Discord 語音頻道',
    attendees: 35,
  },
]

function Dashboard() {
  const [events, setEvents] = useState(PLACEHOLDER_EVENTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })

      if (!error && data && data.length > 0) {
        setEvents(data)
      }
      setLoading(false)
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

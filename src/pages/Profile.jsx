import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { LogOut, Shield, Calendar, Mail } from 'lucide-react'
import './Profile.css'

export default function Profile() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>載入中...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || meta.name || '社群成員'
  const username = meta.user_name || meta.preferred_username
  const email = meta.email || user.email
  const createdAt = new Date(user.created_at).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar-wrapper">
                {avatar ? (
                  <img src={avatar} alt={displayName} className="profile-avatar" />
                ) : (
                  <div className="profile-avatar profile-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="profile-badge">
                  <Shield size={14} />
                </div>
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{displayName}</h1>
                {username && <p className="profile-username">@{username}</p>}
              </div>
            </div>

            <div className="profile-details">
              {email && (
                <div className="profile-detail-item">
                  <Mail size={18} />
                  <span>{email}</span>
                </div>
              )}
              <div className="profile-detail-item">
                <Calendar size={18} />
                <span>加入日期：{createdAt}</span>
              </div>
              <div className="profile-detail-item">
                <Shield size={18} />
                <span>透過 Discord 驗證</span>
              </div>
            </div>

            <div className="profile-actions">
              <button onClick={signOut} className="btn btn-danger">
                <LogOut size={18} />
                登出
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

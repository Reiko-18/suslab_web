import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { LogOut, Shield, Calendar, Mail, Award } from 'lucide-react'
import './Profile.css'

const ROLE_LABELS = {
  admin: '管理員',
  moderator: '版主',
  member: '成員',
}

export default function Profile() {
  const { user, role, loading, signOut } = useAuth()
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    if (user) {
      edgeFunctions.getProfile()
        .then(setProfileData)
        .catch((err) => console.error('Failed to fetch profile:', err))
    }
  }, [user])

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) return null

  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || meta.name || '社群成員'
  const username = meta.user_name || meta.preferred_username
  const email = profileData?.email ?? meta.email ?? user.email
  const displayRole = profileData?.role ?? role
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
              <div className="profile-detail-item">
                <Award size={18} />
                <span>角色：{ROLE_LABELS[displayRole] ?? displayRole}</span>
              </div>
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

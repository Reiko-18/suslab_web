import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import { edgeFunctions } from '../services/edgeFunctions'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

const ROLE_LABELS = {
  admin: '管理員',
  moderator: '版主',
  member: '成員',
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const data = await edgeFunctions.getUsers()
      setUsers(data ?? [])
    } catch (err) {
      setError(err.message ?? '無法載入使用者列表')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole)

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )

      setNotice('角色已更新。該用戶需要重新登入才會生效。')
    } catch (err) {
      setNotice(err.message ?? '角色更新失敗')
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card admin-error">
              <p>{error}</p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container">
          <div className="admin-header">
            <h2><Shield size={24} /> 管理後台</h2>
            <p>管理社群成員角色與權限</p>
          </div>

          {notice && <div className="admin-notice">{notice}</div>}

          <table className="users-table">
            <thead>
              <tr>
                <th>使用者</th>
                <th>Email</th>
                <th>目前角色</th>
                <th>變更角色</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="user-cell-avatar" />
                      ) : (
                        <div className="user-cell-avatar-placeholder">
                          {(u.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{u.display_name}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    {u.id === currentUser?.id ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>（自己）</span>
                    ) : (
                      <select
                        className="role-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="member">成員</option>
                        <option value="moderator">版主</option>
                        <option value="admin">管理員</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

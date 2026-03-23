import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minimumRole = 'member' }) {
  const { user, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!hasRole(minimumRole)) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>權限不足</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            需要 <strong>{minimumRole}</strong> 權限才能存取此頁面。
          </p>
        </div>
      </div>
    )
  }

  return children
}

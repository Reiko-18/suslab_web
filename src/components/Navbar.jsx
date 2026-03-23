import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Leaf, Menu, X, LogIn, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { user, loading, hasRole, signInWithDiscord } = useAuth()

  const links = [
    { to: '/', label: '首頁', public: true },
    { to: '/dashboard', label: '活動紀錄', public: false },
  ]

  const meta = user?.user_metadata || {}
  const avatar = meta.avatar_url
  const displayName = meta.full_name || meta.user_name || '會員'

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">
          <Leaf size={24} />
          <span>SusLab</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {links.map((link) => {
            if (!link.public && !user) return null
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`navbar-link ${location.pathname === link.to ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}

          {user && hasRole('admin') && (
            <Link
              to="/admin"
              className={`navbar-link navbar-admin-link ${location.pathname === '/admin' ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={14} />
              管理後台
            </Link>
          )}

          {!loading && (
            user ? (
              <Link
                to="/profile"
                className="navbar-user"
                onClick={() => setMenuOpen(false)}
              >
                {avatar ? (
                  <img src={avatar} alt={displayName} className="navbar-avatar" />
                ) : (
                  <div className="navbar-avatar navbar-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="navbar-username">{displayName}</span>
              </Link>
            ) : (
              <button onClick={signInWithDiscord} className="btn btn-primary navbar-cta">
                <LogIn size={16} />
                Discord 登入
              </button>
            )
          )}
        </div>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '關閉選單' : '開啟選單'}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  )
}

export default Navbar

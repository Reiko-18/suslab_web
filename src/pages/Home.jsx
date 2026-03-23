import { Users, Calendar, BookOpen, ArrowRight, Sparkles, MessageCircle, Trophy, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  const { user, loading, signInWithDiscord } = useAuth()

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="container hero-content">
          <span className="badge">
            <Sparkles size={14} />
            永續生活實驗室
          </span>
          <h1>歡迎來到 SusLab 社群</h1>
          <p className="hero-subtitle">
            一個關注永續發展的 Discord 社群，在這裡分享知識、參與活動、結交志同道合的夥伴。
          </p>
          <div className="hero-actions">
            {!loading && (
              user ? (
                <Link to="/profile" className="btn btn-primary">
                  我的會員頁面
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <button onClick={signInWithDiscord} className="btn btn-primary">
                  <LogIn size={18} />
                  Discord 登入加入社群
                </button>
              )
            )}
            <a href="#about" className="btn btn-secondary">
              了解更多
            </a>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">500+</div>
              <div className="stat-label">社群成員</div>
            </div>
            <div className="stat">
              <div className="stat-value">120+</div>
              <div className="stat-label">舉辦活動</div>
            </div>
            <div className="stat">
              <div className="stat-value">30+</div>
              <div className="stat-label">合作夥伴</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="about">
        <div className="container">
          <div className="section-header">
            <h2>我們提供什麼</h2>
            <p>SusLab 社群的核心功能與資源</p>
          </div>
          <div className="grid-3">
            <div className="card feature-card">
              <div className="icon-box">
                <BookOpen size={24} />
              </div>
              <h3>伺服器介紹</h3>
              <p>完整的社群導覽，幫助新成員快速了解各頻道功能與社群文化。</p>
            </div>
            <div className="card feature-card">
              <div className="icon-box">
                <Users size={24} />
              </div>
              <h3>人員登記</h3>
              <p>成員資料管理系統，記錄每位成員的專長、興趣與貢獻。</p>
            </div>
            <div className="card feature-card">
              <div className="icon-box">
                <Calendar size={24} />
              </div>
              <h3>活動紀錄</h3>
              <p>追蹤社群活動歷程，包括讀書會、工作坊、線上分享會等。</p>
            </div>
            <div className="card feature-card">
              <div className="icon-box">
                <MessageCircle size={24} />
              </div>
              <h3>討論交流</h3>
              <p>多元主題討論區，從環保議題到日常生活的永續實踐。</p>
            </div>
            <div className="card feature-card">
              <div className="icon-box">
                <Trophy size={24} />
              </div>
              <h3>成就系統</h3>
              <p>透過參與活動和貢獻累積經驗值，解鎖專屬成就徽章。</p>
            </div>
            <div className="card feature-card">
              <div className="icon-box">
                <Sparkles size={24} />
              </div>
              <h3>資源分享</h3>
              <p>精選永續相關文章、影片、工具，建立共享知識庫。</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-card">
            <h2>準備好加入了嗎？</h2>
            <p>成為 SusLab 的一份子，一起為永續未來努力。</p>
            {!loading && (
              user ? (
                <Link to="/profile" className="btn btn-accent">
                  查看會員資料
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <button onClick={signInWithDiscord} className="btn btn-accent">
                  <LogIn size={18} />
                  透過 Discord 登入
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <p>&copy; 2026 SusLab Community. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Home

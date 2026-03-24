import { Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import PublicLayout from './layouts/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Members from './pages/Members'
import Profile from './pages/Profile'
import Events from './pages/Events'
import Todos from './pages/Todos'
import Announcements from './pages/Announcements'
import Games from './pages/Games'
import Feedback from './pages/Feedback'
import Overview from './pages/admin/Overview'
import Roles from './pages/admin/Roles'
import AdminUsers from './pages/admin/Users'
import Tickets from './pages/admin/Tickets'
import FeedbackReview from './pages/admin/FeedbackReview'
import Settings from './pages/admin/Settings'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>

      {/* Authenticated routes — ProtectedRoute renders <Outlet /> when no children */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/members" element={<Members />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/events" element={<Events />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/games" element={<Games />} />
          <Route path="/feedback" element={<Feedback />} />

          {/* Admin routes (moderator+) */}
          <Route element={<ProtectedRoute minimumRole="moderator" />}>
            <Route path="/admin" element={<Overview />} />
            <Route path="/admin/roles" element={<Roles />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/tickets" element={<Tickets />} />
            <Route path="/admin/feedback" element={<FeedbackReview />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

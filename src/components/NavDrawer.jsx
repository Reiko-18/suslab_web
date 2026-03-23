import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { USER_NAV, ADMIN_NAV } from './NavRail'

export default function NavDrawer({ open, onClose, variant = 'temporary' }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || 'User'
  const avatar = meta.avatar_url

  const handleNav = (path) => {
    navigate(path)
    if (variant === 'temporary') onClose()
  }

  const renderItem = ({ key, path, icon: Icon }) => (
    <ListItemButton
      key={path}
      selected={location.pathname === path}
      onClick={() => handleNav(path)}
      sx={{ borderRadius: 6, mx: 1, mb: 0.25 }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}><Icon /></ListItemIcon>
      <ListItemText primary={t(key)} />
    </ListItemButton>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      variant={variant}
      sx={{ '& .MuiDrawer-paper': { width: 240, boxSizing: 'border-box' } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 16, fontWeight: 700 }}>S</Avatar>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>SusLab</Typography>
      </Box>

      <List sx={{ flex: 1 }}>
        {USER_NAV.map(renderItem)}

        {hasRole('moderator') && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ px: 3, py: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('nav.admin.label')}
            </Typography>
            {ADMIN_NAV.map(renderItem)}
          </>
        )}
      </List>

      {user && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
          onClick={() => handleNav('/profile')}
        >
          <Avatar src={avatar} sx={{ width: 32, height: 32 }}>{displayName[0]}</Avatar>
          <Typography variant="body2" noWrap>{displayName}</Typography>
        </Box>
      )}
    </Drawer>
  )
}

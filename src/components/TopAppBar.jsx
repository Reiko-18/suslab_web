import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useThemeControls } from '../theme/ThemeProvider'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import MenuIcon from '@mui/icons-material/Menu'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import { useState } from 'react'
import ThemeColorPicker from './ThemeColorPicker'
import LanguageSelector from './LanguageSelector'

export default function TopAppBar({ title, onMenuClick }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { mode, toggleMode } = useThemeControls()
  const [anchorEl, setAnchorEl] = useState(null)

  const meta = user?.user_metadata || {}
  const displayName = meta.full_name || meta.user_name || 'User'
  const avatar = meta.avatar_url

  return (
    <AppBar position="fixed" color="default" elevation={0}
      sx={{ left: { xs: 0, md: 72 }, width: { xs: '100%', md: 'calc(100% - 72px)' }, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Toolbar>
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 1, display: { md: 'flex' } }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LanguageSelector />
          <IconButton onClick={toggleMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <ThemeColorPicker />

          {user && (
            <>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
                <Avatar src={avatar} sx={{ width: 32, height: 32 }}>{displayName[0]}</Avatar>
              </IconButton>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile') }}>
                  <PersonIcon sx={{ mr: 1 }} /> {t('nav.profile')}
                </MenuItem>
                <MenuItem onClick={() => { setAnchorEl(null); signOut() }}>
                  <LogoutIcon sx={{ mr: 1 }} /> {t('profile.logout')}
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}

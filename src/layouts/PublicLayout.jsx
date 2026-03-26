import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import LanguageSelector from '../components/LanguageSelector'
import ThemeColorPicker from '../components/ThemeColorPicker'
import IconButton from '@mui/material/IconButton'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LoginIcon from '@mui/icons-material/Login'
import Button from '@mui/material/Button'
import { useThemeControls } from '../theme/ThemeProvider'
import { useAuth } from '../context/AuthContext'

export default function PublicLayout() {
  const { t } = useTranslation()
  const { mode, toggleMode } = useThemeControls()
  const { signInWithDiscord } = useAuth()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 14, fontWeight: 700, mr: 1 }}>S</Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>SusLab</Typography>
          <LanguageSelector />
          <IconButton onClick={toggleMode} color="inherit" aria-label={mode === 'dark' ? t('theme.light') : t('theme.dark')}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <ThemeColorPicker />
          <Button
            variant="contained"
            size="small"
            startIcon={<LoginIcon />}
            onClick={signInWithDiscord}
            sx={{
              ml: 1, borderRadius: 6,
              bgcolor: '#4A7C59', color: '#fff',
              '&:hover': { bgcolor: '#3D6B4B' },
              textTransform: 'none', fontWeight: 600,
            }}
          >
            {t('landing.hero.cta')}
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

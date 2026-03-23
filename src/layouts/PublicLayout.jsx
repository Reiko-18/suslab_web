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
import { useThemeControls } from '../theme/ThemeProvider'

export default function PublicLayout() {
  const { t } = useTranslation()
  const { mode, toggleMode } = useThemeControls()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 14, fontWeight: 700, mr: 1 }}>S</Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>SusLab</Typography>
          <LanguageSelector />
          <IconButton onClick={toggleMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <ThemeColorPicker />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

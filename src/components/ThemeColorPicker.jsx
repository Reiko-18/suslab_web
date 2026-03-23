import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeControls } from '../theme/ThemeProvider'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import PaletteIcon from '@mui/icons-material/Palette'

const PRESETS = [
  '#6750A4', '#0061A4', '#006E1C', '#984061',
  '#8B5000', '#006874', '#7D5260', '#1E6B52',
]

export default function ThemeColorPicker() {
  const { t } = useTranslation()
  const { seedColor, setSeedColor } = useThemeControls()
  const [anchorEl, setAnchorEl] = useState(null)

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
        <PaletteIcon />
      </IconButton>
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <Typography variant="subtitle2" gutterBottom>{t('theme.color')}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {PRESETS.map((color) => (
              <Box key={color} onClick={() => { setSeedColor(color); setAnchorEl(null) }}
                sx={{
                  width: 36, height: 36, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                  border: seedColor === color ? '3px solid' : '2px solid transparent',
                  borderColor: seedColor === color ? 'text.primary' : 'transparent',
                  '&:hover': { transform: 'scale(1.15)' }, transition: 'all 0.2s',
                }}
              />
            ))}
          </Box>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <input type="color" value={seedColor} onChange={(e) => setSeedColor(e.target.value)}
              style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">{t('theme.color')}</Typography>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

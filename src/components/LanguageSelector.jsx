import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import TranslateIcon from '@mui/icons-material/Translate'
import CheckIcon from '@mui/icons-material/Check'
import ListItemIcon from '@mui/material/ListItemIcon'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
]

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState(null)

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
        <TranslateIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {LANGUAGES.map(({ code, label }) => (
          <MenuItem key={code} selected={i18n.language === code}
            onClick={() => { i18n.changeLanguage(code); setAnchorEl(null) }}
          >
            <ListItemIcon>{i18n.language === code ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

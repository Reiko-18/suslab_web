import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import SaveIcon from '@mui/icons-material/Save'

interface SettingGroup {
  titleKey: string
  keys: string[]
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    titleKey: 'admin.settings.server',
    keys: ['discord_server_id', 'site_name', 'site_description'],
  },
  {
    titleKey: 'admin.settings.access',
    keys: ['allowed_roles'],
  },
  {
    titleKey: 'admin.settings.tickets',
    keys: ['ticket_discord_channel', 'ticket_visible_roles', 'ticket_auto_categories'],
  },
  {
    titleKey: 'admin.settings.notifications',
    keys: ['notify_new_ticket', 'notify_new_feedback', 'notify_new_user', 'notification_webhook_url'],
  },
]

export default function Settings() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    edgeFunctions.listSettings()
      .then((data: any) => {
        const map: Record<string, any> = {}
        for (const s of (data ?? [])) {
          map[s.key] = s.value
        }
        setSettings(map)
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const batch = Object.entries(settings).map(([key, value]) => ({ key, value }))
      await edgeFunctions.batchUpdateSettings(batch)
      setNotice(t('admin.settings.saved'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderField = (key: string) => {
    const value = settings[key]

    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      const boolVal = value === true || value === 'true'
      return (
        <FormControlLabel
          key={key}
          control={<Switch checked={boolVal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(key, e.target.checked)} disabled={!isAdmin} />}
          label={t(`admin.settings.keys.${key}`)}
          sx={{ display: 'block', mb: 1 }}
        />
      )
    }

    if (Array.isArray(value)) {
      return (
        <TextField
          key={key}
          label={t(`admin.settings.keys.${key}`)}
          fullWidth
          value={JSON.stringify(value)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            try {
              handleChange(key, JSON.parse(e.target.value))
            } catch {
              // allow invalid JSON while typing
            }
          }}
          disabled={!isAdmin}
          helperText="JSON array format"
          sx={{ mb: 2 }}
        />
      )
    }

    return (
      <TextField
        key={key}
        label={t(`admin.settings.keys.${key}`)}
        fullWidth
        value={typeof value === 'string' ? value : JSON.stringify(value)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(key, e.target.value)}
        disabled={!isAdmin}
        sx={{ mb: 2 }}
      />
    )
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.settings.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.settings.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {SETTING_GROUPS.map(({ titleKey, keys }) => (
        <Card key={titleKey} variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t(titleKey)}</Typography>
            {keys.map(renderField)}
          </CardContent>
        </Card>
      ))}

      {isAdmin && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </Box>
        </>
      )}
    </Container>
  )
}

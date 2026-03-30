/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, TextField, Switch, Alert, CircularProgress, Divider } from '../../components/ui'
import { Container } from '../../components/layout'

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
        <div key={key} css={css({ marginBottom: 8 })}>
          <Switch
            checked={boolVal}
            onChange={(checked: boolean) => handleChange(key, checked)}
            label={t(`admin.settings.keys.${key}`)}
            disabled={!isAdmin}
          />
        </div>
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
      />
    )
  }

  if (loading) {
    return (
      <div css={css({ display: 'flex', justifyContent: 'center', padding: '80px 0' })}>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Container maxWidth="md" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>
        {t('admin.settings.title')}
      </h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>
        {t('admin.settings.desc')}
      </p>

      {notice && <Alert severity="success" onClose={() => setNotice(null)} css={css({ marginBottom: 16 })}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} css={css({ marginBottom: 16 })}>{error}</Alert>}

      {SETTING_GROUPS.map(({ titleKey, keys }) => (
        <Card key={titleKey} css={css({ marginBottom: 24, padding: 20 })}>
          <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>{t(titleKey)}</h3>
          <div css={css({ display: 'flex', flexDirection: 'column', gap: 16 })}>
            {keys.map(renderField)}
          </div>
        </Card>
      ))}

      {isAdmin && (
        <>
          <Divider css={css({ marginBottom: 24 })} />
          <div css={css({ display: 'flex', justifyContent: 'flex-end' })}>
            <Button
              variant="primary"
              startIcon="save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </>
      )}
    </Container>
  )
}

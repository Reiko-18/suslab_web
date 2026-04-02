/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { useActiveServer } from '../../hooks/useActiveServer'
import { Button, Card, TextField, Switch, Alert, CircularProgress, Divider } from '../../components/ui'
import { Container } from '../../components/layout'

// Per-server settings shape loaded from server.settings JSONB
interface ServerSettings {
  // Server identity (read-only display)
  name?: string
  discord_guild_id?: string
  // Tickets
  ticket_channels?: string[]
  // Notifications
  notification_webhook_url?: string
  notify_new_ticket?: boolean
  notify_new_feedback?: boolean
  notify_new_user?: boolean
  notify_ticket_status_change?: boolean
  // Access: Discord role ID → member/moderator/admin
  role_mapping?: Record<string, string>
}

const emptySettings = (): ServerSettings => ({
  name: '',
  discord_guild_id: '',
  ticket_channels: [],
  notification_webhook_url: '',
  notify_new_ticket: false,
  notify_new_feedback: false,
  notify_new_user: false,
  notify_ticket_status_change: false,
  role_mapping: {},
})

export default function Settings() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const serverId = useActiveServer()
  const [settings, setSettings] = useState<ServerSettings>(emptySettings())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Role-mapping editor state
  const [roleMappingInput, setRoleMappingInput] = useState<{ discordId: string; role: string }[]>([])

  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    if (!serverId) return
    setLoading(true)
    edgeFunctions.getServerSettings(serverId)
      .then((data: any) => {
        const s: ServerSettings = {
          name: data?.name ?? '',
          discord_guild_id: data?.discord_guild_id ?? '',
          ticket_channels: data?.settings?.ticket_channels ?? [],
          notification_webhook_url: data?.settings?.notification_webhook_url ?? '',
          notify_new_ticket: data?.settings?.notify_new_ticket ?? false,
          notify_new_feedback: data?.settings?.notify_new_feedback ?? false,
          notify_new_user: data?.settings?.notify_new_user ?? false,
          notify_ticket_status_change: data?.settings?.notify_ticket_status_change ?? false,
          role_mapping: data?.settings?.role_mapping ?? {},
        }
        setSettings(s)
        setRoleMappingInput(
          Object.entries(s.role_mapping ?? {}).map(([discordId, role]) => ({ discordId, role }))
        )
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [serverId])

  const handleChange = <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!serverId) return
    setSaving(true)
    setError(null)
    try {
      // Reconstruct role_mapping from editor rows (ignore blank entries)
      const role_mapping: Record<string, string> = {}
      for (const row of roleMappingInput) {
        if (row.discordId.trim() && row.role.trim()) {
          role_mapping[row.discordId.trim()] = row.role.trim()
        }
      }
      const payload: Record<string, unknown> = {
        ticket_channels: settings.ticket_channels,
        notification_webhook_url: settings.notification_webhook_url,
        notify_new_ticket: settings.notify_new_ticket,
        notify_new_feedback: settings.notify_new_feedback,
        notify_new_user: settings.notify_new_user,
        notify_ticket_status_change: settings.notify_ticket_status_change,
        role_mapping,
      }
      await edgeFunctions.updateServerSettings(serverId, payload)
      setSettings((prev) => ({ ...prev, role_mapping }))
      setNotice(t('admin.settings.saved'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // --- Role mapping editor helpers ---
  const handleRoleMappingChange = (idx: number, field: 'discordId' | 'role', value: string) => {
    setRoleMappingInput((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )
  }

  const handleAddRoleRow = () => {
    setRoleMappingInput((prev) => [...prev, { discordId: '', role: 'member' }])
  }

  const handleRemoveRoleRow = (idx: number) => {
    setRoleMappingInput((prev) => prev.filter((_, i) => i !== idx))
  }

  // --- Ticket channels editor helpers ---
  const handleTicketChannelsChange = (raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) handleChange('ticket_channels', parsed)
    } catch {
      // allow invalid JSON while typing
    }
  }

  if (loading) {
    return (
      <div css={css({ display: 'flex', justifyContent: 'center', padding: '80px 0' })}>
        <CircularProgress />
      </div>
    )
  }

  if (!serverId) {
    return (
      <Container maxWidth="md" css={css({ paddingTop: 32, paddingBottom: 32 })}>
        <Alert severity="info">{t('common.noPermission')}</Alert>
      </Container>
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

      {/* Server (read-only) */}
      <Card css={css({ marginBottom: 24, padding: 20 })}>
        <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>
          {t('admin.settings.server')}
        </h3>
        <div css={css({ display: 'flex', flexDirection: 'column', gap: 16 })}>
          <TextField
            label={t('admin.settings.keys.site_name')}
            fullWidth
            value={settings.name ?? ''}
            disabled
          />
          <TextField
            label={t('admin.settings.keys.discord_server_id')}
            fullWidth
            value={settings.discord_guild_id ?? ''}
            disabled
          />
        </div>
      </Card>

      {/* Tickets */}
      <Card css={css({ marginBottom: 24, padding: 20 })}>
        <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>
          {t('admin.settings.tickets')}
        </h3>
        <TextField
          label={t('admin.settings.keys.ticket_discord_channel')}
          fullWidth
          value={JSON.stringify(settings.ticket_channels ?? [])}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTicketChannelsChange(e.target.value)}
          disabled={!isAdmin}
          helperText="JSON array of channel IDs"
        />
      </Card>

      {/* Notifications */}
      <Card css={css({ marginBottom: 24, padding: 20 })}>
        <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>
          {t('admin.settings.notifications')}
        </h3>
        <div css={css({ display: 'flex', flexDirection: 'column', gap: 16 })}>
          <TextField
            label={t('admin.settings.keys.notification_webhook_url')}
            fullWidth
            value={settings.notification_webhook_url ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('notification_webhook_url', e.target.value)}
            disabled={!isAdmin}
          />
          <Switch
            checked={settings.notify_new_ticket ?? false}
            onChange={(checked: boolean) => handleChange('notify_new_ticket', checked)}
            label={t('admin.settings.keys.notify_new_ticket')}
            disabled={!isAdmin}
          />
          <Switch
            checked={settings.notify_new_feedback ?? false}
            onChange={(checked: boolean) => handleChange('notify_new_feedback', checked)}
            label={t('admin.settings.keys.notify_new_feedback')}
            disabled={!isAdmin}
          />
          <Switch
            checked={settings.notify_new_user ?? false}
            onChange={(checked: boolean) => handleChange('notify_new_user', checked)}
            label={t('admin.settings.keys.notify_new_user')}
            disabled={!isAdmin}
          />
          <Switch
            checked={settings.notify_ticket_status_change ?? false}
            onChange={(checked: boolean) => handleChange('notify_ticket_status_change', checked)}
            label={t('admin.settings.keys.notify_ticket_status_change')}
            disabled={!isAdmin}
          />
        </div>
      </Card>

      {/* Access — role mapping */}
      <Card css={css({ marginBottom: 24, padding: 20 })}>
        <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 4px' })}>
          {t('admin.settings.access')}
        </h3>
        <p css={css({ fontSize: 13, color: 'var(--color-on-surface-muted)', margin: '0 0 16px' })}>
          {t('admin.settings.roleMappingDesc')}
        </p>
        <div css={css({ display: 'flex', flexDirection: 'column', gap: 8 })}>
          {roleMappingInput.map((row, idx) => (
            <div key={idx} css={css({ display: 'flex', gap: 8, alignItems: 'center' })}>
              <TextField
                label="Discord Role ID"
                value={row.discordId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleRoleMappingChange(idx, 'discordId', e.target.value)
                }
                disabled={!isAdmin}
                css={css({ flex: 2 })}
              />
              <TextField
                label={t('admin.users.changeRole')}
                value={row.role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleRoleMappingChange(idx, 'role', e.target.value)
                }
                disabled={!isAdmin}
                css={css({ flex: 1 })}
              />
              {isAdmin && (
                <Button
                  variant="icon"
                  onClick={() => handleRemoveRoleRow(idx)}
                  css={css({ color: 'var(--color-error)', flexShrink: 0 })}
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
          {isAdmin && (
            <Button variant="ghost" size="small" startIcon="add" onClick={handleAddRoleRow}>
              {t('admin.settings.addRoleMapping')}
            </Button>
          )}
        </div>
      </Card>

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

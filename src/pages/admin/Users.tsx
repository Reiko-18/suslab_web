/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { useActiveServer } from '../../hooks/useActiveServer'
import { Icon, Button, Chip, Avatar, Select, Alert, CircularProgress, Tabs, Tooltip, Table } from '../../components/ui'
import { Container } from '../../components/layout'
import UserActionDialog from '../../components/admin/UserActionDialog'
import AuditLogTable from '../../components/admin/AuditLogTable'

interface ActionDialogState {
  open: boolean
  type: string | null
  user: any | null
}

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const serverId = useActiveServer()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState('users')

  const [actionDialog, setActionDialog] = useState<ActionDialogState>({ open: false, type: null, user: null })

  useEffect(() => {
    edgeFunctions.getUsers(serverId)
      .then((data: any) => setUsers(data ?? []))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [serverId])

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole, serverId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      setNotice(t('admin.users.roleUpdated'))
    } catch (err: any) {
      setNotice(err.message ?? t('admin.users.roleUpdateFailed'))
    }
  }

  async function handleAction({ actionType, userId, reason, durationMinutes }: {
    actionType: string
    userId: string
    reason?: string
    durationMinutes?: number
  }) {
    if (actionType === 'ban') {
      await edgeFunctions.banUser(userId, reason, serverId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u)))
      setNotice(t('admin.users.actions.banned'))
    } else if (actionType === 'kick') {
      await edgeFunctions.kickUser(userId, reason, serverId)
      setNotice(t('admin.users.actions.kicked'))
    } else if (actionType === 'timeout') {
      const result = await edgeFunctions.timeoutUser(userId, durationMinutes, reason, serverId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, timeout_until: result.timeout_until } : u)))
      setNotice(t('admin.users.actions.timedOut'))
    }
  }

  async function handleUnban(userId: string) {
    try {
      await edgeFunctions.unbanUser(userId, serverId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u)))
      setNotice(t('admin.users.actions.unbanned'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div css={css({ display: 'flex', justifyContent: 'center', padding: '80px 0' })}>
        <CircularProgress />
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      header: t('admin.users.name'),
      render: (u: any) => (
        <div css={css({ display: 'flex', alignItems: 'center', gap: 8, opacity: u.is_banned ? 0.5 : 1 })}>
          <Avatar src={u.avatar_url} size={32} fallback={(u.display_name || '?')[0]} />
          {u.display_name}
        </div>
      ),
    },
    { key: 'email', header: t('admin.users.email') },
    {
      key: 'role',
      header: t('admin.users.currentRole'),
      render: (u: any) => (
        <Chip
          label={t(`profile.roles.${u.role}`) || u.role}
          size="small"
          color={u.role === 'admin' ? 'var(--color-error)' : u.role === 'moderator' ? 'var(--color-warning)' : undefined}
        />
      ),
    },
    {
      key: 'status',
      header: t('admin.users.status'),
      render: (u: any) => {
        const isTimedOut = u.timeout_until && new Date(u.timeout_until) > new Date()
        if (u.is_banned) return <Chip label={t('admin.users.statusBanned')} size="small" color="var(--color-error)" />
        if (isTimedOut) return <Chip label={t('admin.users.statusTimeout')} size="small" color="var(--color-warning)" />
        return <Chip label={t('admin.users.statusActive')} size="small" color="var(--color-success)" />
      },
    },
    {
      key: 'changeRole',
      header: t('admin.users.changeRole'),
      render: (u: any) => {
        const isSelf = u.id === currentUser?.id
        if (isSelf) return <span css={css({ fontSize: 14, color: 'var(--color-on-surface-muted)' })}>{t('admin.users.self')}</span>
        return (
          <Select
            value={u.role}
            onChange={(val: string) => handleRoleChange(u.id, val)}
            options={[
              { value: 'member', label: t('profile.roles.member') },
              { value: 'moderator', label: t('profile.roles.moderator') },
              { value: 'admin', label: t('profile.roles.admin') },
            ]}
          />
        )
      },
    },
    {
      key: 'actions',
      header: t('admin.users.actions.label'),
      render: (u: any) => {
        const isSelf = u.id === currentUser?.id
        if (isSelf) return null
        return (
          <div css={css({ display: 'flex', gap: 4, justifyContent: 'flex-end' })}>
            {u.is_banned ? (
              <Tooltip content={t('admin.users.actions.unban')}>
                <Button variant="icon" onClick={() => handleUnban(u.id)} css={css({ color: 'var(--color-success)' })}>
                  <Icon name="check_circle" size={18} />
                </Button>
              </Tooltip>
            ) : (
              <>
                <Tooltip content={t('admin.users.actions.ban')}>
                  <Button variant="icon" onClick={() => setActionDialog({ open: true, type: 'ban', user: u })} css={css({ color: 'var(--color-error)' })}>
                    <Icon name="block" size={18} />
                  </Button>
                </Tooltip>
                <Tooltip content={t('admin.users.actions.kick')}>
                  <Button variant="icon" onClick={() => setActionDialog({ open: true, type: 'kick', user: u })} css={css({ color: 'var(--color-warning)' })}>
                    <Icon name="logout" size={18} />
                  </Button>
                </Tooltip>
                <Tooltip content={t('admin.users.actions.timeout')}>
                  <Button variant="icon" onClick={() => setActionDialog({ open: true, type: 'timeout', user: u })}>
                    <Icon name="timer" size={18} />
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>{t('admin.users.title')}</h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>{t('admin.users.desc')}</p>

      {notice && <Alert severity="info" onClose={() => setNotice(null)} css={css({ marginBottom: 16 })}>{notice}</Alert>}
      {error && <Alert severity="error" css={css({ marginBottom: 16 })}>{error}</Alert>}

      <Tabs
        tabs={[
          { label: t('admin.users.tabUsers'), value: 'users' },
          { label: t('admin.users.tabAuditLog'), value: 'audit' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div css={css({ marginTop: 16 })}>
        {tab === 'users' && (
          <Table
            columns={columns}
            data={users}
            keyExtractor={(u: any) => u.id}
          />
        )}

        {tab === 'audit' && <AuditLogTable />}
      </div>

      <UserActionDialog
        open={actionDialog.open}
        onClose={() => setActionDialog({ open: false, type: null, user: null })}
        actionType={actionDialog.type}
        targetUser={actionDialog.user}
        onConfirm={handleAction}
      />
    </Container>
  )
}

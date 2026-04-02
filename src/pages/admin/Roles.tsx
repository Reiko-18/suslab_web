/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useActiveServer } from '../../hooks/useActiveServer'
import { Icon, Button, Chip, Alert, CircularProgress, Table } from '../../components/ui'
import { Container } from '../../components/layout'
import RoleDialog from '../../components/admin/RoleDialog'

export default function Roles() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const serverId = useActiveServer()
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)

  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    edgeFunctions.listRoles(serverId)
      .then((data: any) => setRoles(data ?? []))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [serverId])

  const handleSave = async ({ id, name, color, position }: { id?: string; name: string; color: string; position: number }) => {
    if (id) {
      const updated = await edgeFunctions.updateRole(id, { name, color, position, server_id: serverId })
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setNotice(t('admin.roles.updated'))
    } else {
      const created = await edgeFunctions.createRole({ name, color, position, server_id: serverId })
      setRoles((prev) => [...prev, created])
      setNotice(t('admin.roles.created'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.roles.confirmDelete'))) return
    try {
      await edgeFunctions.deleteRole(id, serverId)
      setRoles((prev) => prev.filter((r) => r.id !== id))
      setNotice(t('admin.roles.deleted'))
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
      header: t('admin.roles.name'),
      render: (r: any) => (
        <div css={css({ display: 'flex', alignItems: 'center', gap: 8 })}>
          <div css={css({ width: 12, height: 12, borderRadius: '50%', background: r.color })} />
          {r.name}
        </div>
      ),
    },
    { key: 'color', header: t('admin.roles.color') },
    { key: 'position', header: t('admin.roles.position'), render: (r: any) => String(r.position) },
    {
      key: 'syncStatus',
      header: t('admin.roles.syncStatus'),
      render: (r: any) => (
        <Chip
          icon="sync"
          label={r.is_synced ? t('admin.roles.synced') : t('admin.roles.notSynced')}
          size="small"
          variant="outlined"
          color={r.is_synced ? 'var(--color-success)' : undefined}
        />
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: t('admin.roles.actions'),
            render: (r: any) => (
              <div css={css({ display: 'flex', gap: 4, justifyContent: 'flex-end' })}>
                <Button variant="icon" onClick={() => { setEditingRole(r); setDialogOpen(true) }}>
                  <Icon name="edit" size={18} />
                </Button>
                <Button variant="icon" onClick={() => handleDelete(r.id)} css={css({ color: 'var(--color-error)' })}>
                  <Icon name="delete" size={18} />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>
        {t('admin.roles.title')}
      </h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>
        {t('admin.roles.desc')}
      </p>

      {notice && <Alert severity="success" onClose={() => setNotice(null)} css={css({ marginBottom: 16 })}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} css={css({ marginBottom: 16 })}>{error}</Alert>}

      <Table
        columns={columns}
        data={roles}
        keyExtractor={(r: any) => r.id}
      />

      {roles.length === 0 && (
        <p css={css({ textAlign: 'center', color: 'var(--color-on-surface-muted)', padding: '32px 0' })}>
          {t('admin.roles.empty')}
        </p>
      )}

      {isAdmin && (
        <Button variant="fab" onClick={() => { setEditingRole(null); setDialogOpen(true) }}>
          <Icon name="add" />
        </Button>
      )}

      <RoleDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRole(null) }}
        role={editingRole}
        onSave={handleSave}
      />
    </Container>
  )
}

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { Icon, Button, Card, Skeleton, Snackbar, Dialog } from '../components/ui'
import { Container, Stack } from '../components/layout'
import AnnouncementCard from '../components/AnnouncementCard'
import AnnouncementDialog from '../components/AnnouncementDialog'

interface SnackbarState {
  open: boolean
  severity: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export default function Announcements() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, severity: 'success', message: '' })

  const canManage: boolean = hasRole('moderator')
  const canDelete: boolean = hasRole('admin')

  const loadAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const data = await edgeFunctions.listAnnouncements({ pageSize: 50 })
      setAnnouncements(data.announcements ?? [])
    } catch (err) {
      console.error('Failed to load announcements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  const handleSave = async (formData: any, id?: string) => {
    if (id) {
      await edgeFunctions.updateAnnouncement(id, formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.updated') })
    } else {
      await edgeFunctions.createAnnouncement(formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.created') })
    }
    await loadAnnouncements()
  }

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement)
    setDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingAnnouncement(null)
    setDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await edgeFunctions.deleteAnnouncement(deleteTarget.id)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.deleted') })
      setDeleteTarget(null)
      await loadAnnouncements()
    } catch (err) {
      console.error('Failed to delete announcement:', err)
    }
  }

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>
        {t('announcements.title')}
      </h1>

      {loading ? (
        <Stack gap={16}>
          {[1, 2, 3].map((i) => (
            <Card key={i} css={css({ padding: 16 })}>
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="80%" />
            </Card>
          ))}
        </Stack>
      ) : announcements.length === 0 ? (
        <div css={css({ textAlign: 'center', padding: '48px 0' })}>
          <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('announcements.empty')}</p>
        </div>
      ) : (
        <Stack gap={0}>
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onEdit={handleEdit}
              onDelete={(a: any) => setDeleteTarget(a)}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </Stack>
      )}

      {canManage && (
        <Button variant="fab" onClick={handleCreate} aria-label={t('announcements.create')}>
          <Icon name="add" />
        </Button>
      )}

      <AnnouncementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        announcement={editingAnnouncement}
        onSave={handleSave}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('announcements.delete')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleDeleteConfirm} css={css({ background: 'var(--color-error)' })}>
              {t('announcements.delete')}
            </Button>
          </>
        }
      >
        <p css={css({ margin: 0, color: 'var(--color-on-surface-muted)' })}>{t('announcements.confirmDelete')}</p>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Container>
  )
}

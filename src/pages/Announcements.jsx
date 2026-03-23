import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import AnnouncementCard from '../components/AnnouncementCard'
import AnnouncementDialog from '../components/AnnouncementDialog'

export default function Announcements() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' })

  const canManage = hasRole('moderator')
  const canDelete = hasRole('admin')

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

  const handleSave = async (formData, id) => {
    if (id) {
      await edgeFunctions.updateAnnouncement(id, formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.updated') })
    } else {
      await edgeFunctions.createAnnouncement(formData)
      setSnackbar({ open: true, severity: 'success', message: t('announcements.created') })
    }
    await loadAnnouncements()
  }

  const handleEdit = (announcement) => {
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('announcements.title')}
      </Typography>

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton variant="text" width="40%" height={32} />
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : announcements.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">{t('announcements.empty')}</Typography>
        </Box>
      ) : (
        <Stack spacing={0}>
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </Stack>
      )}

      {/* Create FAB — moderator+ */}
      {canManage && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={handleCreate}
          title={t('announcements.create')}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create/Edit Dialog */}
      <AnnouncementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        announcement={editingAnnouncement}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('announcements.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('announcements.confirmDelete')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {t('announcements.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

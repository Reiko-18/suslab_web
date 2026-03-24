// src/pages/admin/Roles.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { edgeFunctions } from '../../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SyncIcon from '@mui/icons-material/Sync'
import RoleDialog from '../../components/admin/RoleDialog'

export default function Roles() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  const isAdmin = hasRole('admin')

  useEffect(() => {
    edgeFunctions.listRoles()
      .then((data) => setRoles(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async ({ id, name, color, position }) => {
    if (id) {
      const updated = await edgeFunctions.updateRole(id, { name, color, position })
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setNotice(t('admin.roles.updated'))
    } else {
      const created = await edgeFunctions.createRole({ name, color, position })
      setRoles((prev) => [...prev, created])
      setNotice(t('admin.roles.created'))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('admin.roles.confirmDelete'))) return
    try {
      await edgeFunctions.deleteRole(id)
      setRoles((prev) => prev.filter((r) => r.id !== id))
      setNotice(t('admin.roles.deleted'))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.roles.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.roles.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.roles.name')}</TableCell>
              <TableCell>{t('admin.roles.color')}</TableCell>
              <TableCell>{t('admin.roles.position')}</TableCell>
              <TableCell>{t('admin.roles.syncStatus')}</TableCell>
              {isAdmin && <TableCell align="right">{t('admin.roles.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.color }} />
                    {r.name}
                  </Box>
                </TableCell>
                <TableCell>{r.color}</TableCell>
                <TableCell>{r.position}</TableCell>
                <TableCell>
                  <Chip
                    icon={<SyncIcon />}
                    label={r.is_synced ? t('admin.roles.synced') : t('admin.roles.notSynced')}
                    size="small"
                    color={r.is_synced ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                {isAdmin && (
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => { setEditingRole(r); setDialogOpen(true) }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} align="center">
                  <Typography color="text.secondary">{t('admin.roles.empty')}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {isAdmin && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => { setEditingRole(null); setDialogOpen(true) }}
        >
          <AddIcon />
        </Fab>
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

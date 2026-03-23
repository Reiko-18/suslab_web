import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    edgeFunctions.getUsers()
      .then((data) => setUsers(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(userId, newRole) {
    try {
      setNotice(null)
      await edgeFunctions.updateUserRole(userId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      setNotice(t('admin.users.roleUpdated'))
    } catch (err) {
      setNotice(err.message ?? t('admin.users.roleUpdateFailed'))
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('admin.users.title')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{t('admin.users.desc')}</Typography>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.users.name')}</TableCell>
              <TableCell>{t('admin.users.email')}</TableCell>
              <TableCell>{t('admin.users.currentRole')}</TableCell>
              <TableCell>{t('admin.users.changeRole')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={u.avatar_url} sx={{ width: 32, height: 32 }}>{(u.display_name || '?')[0]}</Avatar>
                    {u.display_name}
                  </Box>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip label={t(`profile.roles.${u.role}`) || u.role} size="small"
                    color={u.role === 'admin' ? 'error' : u.role === 'moderator' ? 'warning' : 'primary'} />
                </TableCell>
                <TableCell>
                  {u.id === currentUser?.id ? (
                    <Typography variant="body2" color="text.secondary">{t('admin.users.self')}</Typography>
                  ) : (
                    <Select value={u.role} size="small" onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      <MenuItem value="member">{t('profile.roles.member')}</MenuItem>
                      <MenuItem value="moderator">{t('profile.roles.moderator')}</MenuItem>
                      <MenuItem value="admin">{t('profile.roles.admin')}</MenuItem>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}

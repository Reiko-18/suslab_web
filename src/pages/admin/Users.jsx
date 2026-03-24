// src/pages/admin/Users.jsx
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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import BlockIcon from '@mui/icons-material/Block'
import LogoutIcon from '@mui/icons-material/Logout'
import TimerIcon from '@mui/icons-material/Timer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import UserActionDialog from '../../components/admin/UserActionDialog'
import AuditLogTable from '../../components/admin/AuditLogTable'

export default function AdminUsers() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState(0)

  // Action dialog state
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, user: null })

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

  async function handleAction({ actionType, userId, reason, durationMinutes }) {
    if (actionType === 'ban') {
      await edgeFunctions.banUser(userId, reason)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true, ban_reason: reason } : u)))
      setNotice(t('admin.users.actions.banned'))
    } else if (actionType === 'kick') {
      await edgeFunctions.kickUser(userId, reason)
      setNotice(t('admin.users.actions.kicked'))
    } else if (actionType === 'timeout') {
      const result = await edgeFunctions.timeoutUser(userId, durationMinutes, reason)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, timeout_until: result.timeout_until } : u)))
      setNotice(t('admin.users.actions.timedOut'))
    }
  }

  async function handleUnban(userId) {
    try {
      await edgeFunctions.unbanUser(userId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: false, ban_reason: null } : u)))
      setNotice(t('admin.users.actions.unbanned'))
    } catch (err) {
      setError(err.message)
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

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('admin.users.tabUsers')} />
        <Tab label={t('admin.users.tabAuditLog')} />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.users.name')}</TableCell>
                <TableCell>{t('admin.users.email')}</TableCell>
                <TableCell>{t('admin.users.currentRole')}</TableCell>
                <TableCell>{t('admin.users.status')}</TableCell>
                <TableCell>{t('admin.users.changeRole')}</TableCell>
                <TableCell align="right">{t('admin.users.actions.label')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                const isTimedOut = u.timeout_until && new Date(u.timeout_until) > new Date()

                return (
                  <TableRow key={u.id} sx={u.is_banned ? { opacity: 0.5 } : {}}>
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
                      {u.is_banned && <Chip label={t('admin.users.statusBanned')} size="small" color="error" />}
                      {isTimedOut && <Chip label={t('admin.users.statusTimeout')} size="small" color="warning" />}
                      {!u.is_banned && !isTimedOut && <Chip label={t('admin.users.statusActive')} size="small" color="success" />}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Typography variant="body2" color="text.secondary">{t('admin.users.self')}</Typography>
                      ) : (
                        <Select value={u.role} size="small" onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                          <MenuItem value="member">{t('profile.roles.member')}</MenuItem>
                          <MenuItem value="moderator">{t('profile.roles.moderator')}</MenuItem>
                          <MenuItem value="admin">{t('profile.roles.admin')}</MenuItem>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!isSelf && (
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {u.is_banned ? (
                            <Tooltip title={t('admin.users.actions.unban')}>
                              <IconButton size="small" color="success" onClick={() => handleUnban(u.id)}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <>
                              <Tooltip title={t('admin.users.actions.ban')}>
                                <IconButton size="small" color="error"
                                  onClick={() => setActionDialog({ open: true, type: 'ban', user: u })}>
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('admin.users.actions.kick')}>
                                <IconButton size="small" color="warning"
                                  onClick={() => setActionDialog({ open: true, type: 'kick', user: u })}>
                                  <LogoutIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('admin.users.actions.timeout')}>
                                <IconButton size="small"
                                  onClick={() => setActionDialog({ open: true, type: 'timeout', user: u })}>
                                  <TimerIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && <AuditLogTable />}

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

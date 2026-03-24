// src/pages/admin/Tickets.jsx
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
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import TicketDetailDialog from '../../components/admin/TicketDetailDialog'
import TicketCreateDialog from '../../components/admin/TicketCreateDialog'

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed']
const STATUS_COLORS = { open: 'info', in_progress: 'warning', resolved: 'success', closed: 'default' }
const PRIORITY_COLORS = { low: 'default', normal: 'info', high: 'warning', urgent: 'error' }

export default function Tickets() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [statusFilter, setStatusFilter] = useState(0)
  const [detailTicket, setDetailTicket] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  const isAdmin = hasRole('admin')

  useEffect(() => {
    let cancelled = false
    const status = STATUS_TABS[statusFilter]
    const controller = new AbortController()
    edgeFunctions.listTickets({ status: status === 'all' ? undefined : status })
      .then((data) => { if (!cancelled) { setTickets(data ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true; controller.abort() }
  }, [statusFilter])

  const handleCreate = async (ticketData) => {
    const created = await edgeFunctions.createTicket(ticketData)
    setTickets((prev) => [created, ...prev])
    setNotice(t('admin.tickets.created'))
  }

  const handleUpdate = (updated) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  const handleDelete = async (id) => {
    if (!confirm(t('admin.tickets.confirmDelete'))) return
    try {
      await edgeFunctions.deleteTicket(id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      setNotice(t('admin.tickets.deleted'))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('admin.tickets.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.tickets.desc')}
      </Typography>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={statusFilter} onChange={(_, v) => setStatusFilter(v)} sx={{ mb: 2 }}>
        {STATUS_TABS.map((s) => (
          <Tab key={s} label={t(`admin.tickets.status.${s}`)} />
        ))}
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.tickets.titleLabel')}</TableCell>
                <TableCell>{t('admin.tickets.author')}</TableCell>
                <TableCell>{t('admin.tickets.categoryLabel')}</TableCell>
                <TableCell>{t('admin.tickets.priorityLabel')}</TableCell>
                <TableCell>{t('admin.tickets.statusLabel')}</TableCell>
                <TableCell>{t('admin.tickets.date')}</TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailTicket(ticket)}
                >
                  <TableCell>{ticket.title}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={ticket.author_avatar} sx={{ width: 24, height: 24 }}>
                        {(ticket.author_name ?? '?')[0]}
                      </Avatar>
                      {ticket.author_name}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.priority.${ticket.priority}`)} size="small" color={PRIORITY_COLORS[ticket.priority]} />
                  </TableCell>
                  <TableCell>
                    <Chip label={t(`admin.tickets.status.${ticket.status}`)} size="small" color={STATUS_COLORS[ticket.status]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{new Date(ticket.created_at).toLocaleDateString()}</Typography>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id) }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} align="center">
                    <Typography color="text.secondary">{t('admin.tickets.empty')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Fab color="primary" sx={{ position: 'fixed', bottom: 24, right: 24 }} onClick={() => setCreateOpen(true)}>
        <AddIcon />
      </Fab>

      <TicketDetailDialog
        open={Boolean(detailTicket)}
        onClose={() => setDetailTicket(null)}
        ticket={detailTicket}
        onUpdate={handleUpdate}
      />

      <TicketCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreate}
      />
    </Container>
  )
}

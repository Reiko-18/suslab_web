import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import type { ChipOwnProps } from '@mui/material/Chip'

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

interface Ticket {
  id: string
  title: string
  content: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  source: string
  created_at: string
  author_name?: string
  author_avatar?: string
}

interface TicketReply {
  id: string
  content: string
  created_at: string
  author_name?: string
  author_avatar?: string
}

interface TicketDetailDialogProps {
  open: boolean
  onClose: () => void
  ticket: Ticket | null
  onUpdate: (updated: Ticket) => void
}

const STATUS_COLORS: Record<TicketStatus, ChipOwnProps['color']> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
}

const PRIORITY_COLORS: Record<TicketPriority, ChipOwnProps['color']> = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
}

export default function TicketDetailDialog({ open, onClose, ticket, onUpdate }: TicketDetailDialogProps) {
  const { t } = useTranslation()
  const [replies, setReplies] = useState<TicketReply[]>([])
  const [replyText, setReplyText] = useState('')
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? 'open')
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority ?? 'normal')

  useEffect(() => {
    if (open && ticket) {
      setStatus(ticket.status)
      setPriority(ticket.priority)
      setLoadingReplies(true)
      edgeFunctions.getTicketReplies(ticket.id)
        .then((data) => setReplies(data ?? []))
        .catch(() => setReplies([]))
        .finally(() => setLoadingReplies(false))
    }
  }, [open, ticket])

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return
    setSending(true)
    try {
      const reply = await edgeFunctions.replyTicket(ticket.id, replyText.trim())
      setReplies((prev) => [...prev, reply])
      setReplyText('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return
    setStatus(newStatus)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status: newStatus, priority })
      onUpdate({ ...ticket, status: newStatus, priority })
    } catch {
      setStatus(ticket.status)
    }
  }

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticket) return
    setPriority(newPriority)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status, priority: newPriority })
      onUpdate({ ...ticket, status, priority: newPriority })
    } catch {
      setPriority(ticket.priority)
    }
  }

  if (!ticket) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>{ticket.title}</Typography>
          <Chip label={t(`admin.tickets.status.${ticket.status}`)} color={STATUS_COLORS[ticket.status]} size="small" />
          <Chip label={t(`admin.tickets.priority.${ticket.priority}`)} color={PRIORITY_COLORS[ticket.priority]} size="small" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Avatar src={ticket.author_avatar} sx={{ width: 24, height: 24 }}>
            {(ticket.author_name ?? '?')[0]}
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            {ticket.author_name} &middot; {new Date(ticket.created_at).toLocaleString()}
          </Typography>
          <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />
          <Chip label={ticket.source.toUpperCase()} size="small" variant="outlined" />
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{ticket.content}</Typography>
        </Paper>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('admin.tickets.statusLabel')}</InputLabel>
            <Select
              value={status}
              label={t('admin.tickets.statusLabel')}
              onChange={(e: SelectChangeEvent<TicketStatus>) => handleStatusChange(e.target.value as TicketStatus)}
            >
              {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
                <MenuItem key={s} value={s}>{t(`admin.tickets.status.${s}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('admin.tickets.priorityLabel')}</InputLabel>
            <Select
              value={priority}
              label={t('admin.tickets.priorityLabel')}
              onChange={(e: SelectChangeEvent<TicketPriority>) => handlePriorityChange(e.target.value as TicketPriority)}
            >
              {(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((p) => (
                <MenuItem key={p} value={p}>{t(`admin.tickets.priority.${p}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('admin.tickets.replies')}</Typography>

        {loadingReplies ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
        ) : (
          replies.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Avatar src={r.author_avatar} sx={{ width: 20, height: 20 }}>{(r.author_name ?? '?')[0]}</Avatar>
                <Typography variant="caption" color="text.secondary">
                  {r.author_name} &middot; {new Date(r.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{r.content}</Typography>
            </Paper>
          ))
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('admin.tickets.replyPlaceholder')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
          />
          <Button variant="contained" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
            {t('admin.tickets.send')}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  )
}

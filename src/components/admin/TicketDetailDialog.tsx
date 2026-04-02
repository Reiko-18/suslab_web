/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { Dialog, TextField, Chip, Avatar, Button, Divider, Select, CircularProgress } from '../ui'

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

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string }> = {
  open: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  in_progress: { bg: 'var(--color-warning)', color: '#000' },
  resolved: { bg: 'var(--color-success)', color: '#fff' },
  closed: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface)' },
}

const PRIORITY_COLORS: Record<TicketPriority, { bg: string; color: string }> = {
  low: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface)' },
  normal: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  high: { bg: 'var(--color-warning)', color: '#000' },
  urgent: { bg: 'var(--color-error)', color: '#fff' },
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
        .then((data) => setReplies(Array.isArray(data) ? data : []))
        .catch(() => setReplies([]))
        .finally(() => setLoadingReplies(false))
    }
  }, [open, ticket])

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticket) return
    setSending(true)
    try {
      const reply = await edgeFunctions.replyTicket(ticket.id, replyText.trim()) as TicketReply
      setReplies((prev) => [...prev, reply])
      setReplyText('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return
    const s = newStatus as TicketStatus
    setStatus(s)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status: s, priority })
      onUpdate({ ...ticket, status: s, priority })
    } catch {
      setStatus(ticket.status)
    }
  }

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticket) return
    const p = newPriority as TicketPriority
    setPriority(p)
    try {
      await edgeFunctions.updateTicket(ticket.id, { status, priority: p })
      onUpdate({ ...ticket, status, priority: p })
    } catch {
      setPriority(ticket.priority)
    }
  }

  if (!ticket) return null

  const statusStyle = STATUS_COLORS[ticket.status]
  const priorityStyle = PRIORITY_COLORS[ticket.priority]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={720}
      title=""
      actions={
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      }
    >
      {/* 標題 + 標籤 */}
      <div css={css`display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: var(--spacing-3);`}>
        <h2 css={css`font-size: 18px; font-weight: 600; color: var(--color-on-surface); margin: 0; flex: 1; min-width: 0;`}>
          {ticket.title}
        </h2>
        <Chip
          label={t(`admin.tickets.status.${ticket.status}`)}
          size="small"
          bg={statusStyle.bg}
          color={statusStyle.color}
        />
        <Chip
          label={t(`admin.tickets.priority.${ticket.priority}`)}
          size="small"
          bg={priorityStyle.bg}
          color={priorityStyle.color}
        />
      </div>

      {/* 作者資訊 */}
      <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: var(--spacing-3);`}>
        <Avatar src={ticket.author_avatar} size={24} fallback={(ticket.author_name ?? '?')[0]} />
        <span css={css`font-size: 13px; color: var(--color-on-surface-muted);`}>
          {ticket.author_name} &middot; {new Date(ticket.created_at).toLocaleString()}
        </span>
        <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />
        <Chip label={ticket.source.toUpperCase()} size="small" variant="outlined" />
      </div>

      {/* 內容 */}
      <div
        css={css`
          padding: var(--spacing-3);
          border: 1px solid var(--color-divider);
          border-radius: var(--radius-sm);
          margin-bottom: var(--spacing-4);
        `}
      >
        <p css={css`white-space: pre-wrap; color: var(--color-on-surface); margin: 0; font-size: 14px;`}>
          {ticket.content}
        </p>
      </div>

      {/* 狀態 + 優先度控制 */}
      <div css={css`display: flex; gap: var(--spacing-3); margin-bottom: var(--spacing-4);`}>
        <Select
          label={t('admin.tickets.statusLabel')}
          value={status}
          onChange={handleStatusChange}
          options={(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => ({
            value: s,
            label: t(`admin.tickets.status.${s}`),
          }))}
        />
        <Select
          label={t('admin.tickets.priorityLabel')}
          value={priority}
          onChange={handlePriorityChange}
          options={(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((p) => ({
            value: p,
            label: t(`admin.tickets.priority.${p}`),
          }))}
        />
      </div>

      <Divider />
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: var(--spacing-3) 0 8px 0;`}>
        {t('admin.tickets.replies')}
      </p>

      {loadingReplies ? (
        <div css={css`display: flex; justify-content: center; padding: var(--spacing-3) 0;`}>
          <CircularProgress size={24} />
        </div>
      ) : (
        <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
          {replies.map((r) => (
            <div
              key={r.id}
              css={css`
                padding: 12px;
                border: 1px solid var(--color-divider);
                border-radius: var(--radius-sm);
              `}
            >
              <div css={css`display: flex; align-items: center; gap: 8px; margin-bottom: 4px;`}>
                <Avatar src={r.author_avatar} size={20} fallback={(r.author_name ?? '?')[0]} />
                <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>
                  {r.author_name} &middot; {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <p css={css`font-size: 13px; white-space: pre-wrap; color: var(--color-on-surface); margin: 0;`}>
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 回覆輸入 */}
      <div css={css`display: flex; gap: 8px; margin-top: var(--spacing-3);`}>
        <TextField
          fullWidth
          placeholder={t('admin.tickets.replyPlaceholder')}
          value={replyText}
          onChange={(e) => setReplyText((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
        />
        <Button variant="primary" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
          {t('admin.tickets.send')}
        </Button>
      </div>
    </Dialog>
  )
}

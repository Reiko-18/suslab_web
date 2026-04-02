/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { useAuth } from '../../context/AuthContext'
import { useActiveServer } from '../../hooks/useActiveServer'
import { Icon, Button, Chip, Avatar, Alert, CircularProgress, Tabs, Table } from '../../components/ui'
import { Container } from '../../components/layout'
import TicketDetailDialog from '../../components/admin/TicketDetailDialog'
import TicketCreateDialog from '../../components/admin/TicketCreateDialog'

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const
const STATUS_COLORS: Record<string, string> = {
  open: 'var(--color-info, var(--color-primary))',
  in_progress: 'var(--color-warning)',
  resolved: 'var(--color-success)',
  closed: undefined as unknown as string,
}
const PRIORITY_COLORS: Record<string, string> = {
  low: undefined as unknown as string,
  normal: 'var(--color-info, var(--color-primary))',
  high: 'var(--color-warning)',
  urgent: 'var(--color-error)',
}

export default function Tickets() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailTicket, setDetailTicket] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const serverId = useActiveServer()
  const isAdmin: boolean = hasRole('admin')

  useEffect(() => {
    let cancelled = false
    edgeFunctions.listTickets({ status: statusFilter === 'all' ? undefined : statusFilter, server_id: serverId })
      .then((data: any) => { if (!cancelled) { setTickets(data ?? []); setLoading(false) } })
      .catch((err: any) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [statusFilter, serverId])

  const handleCreate = async (ticketData: any) => {
    const created = await edgeFunctions.createTicket({ ...ticketData, server_id: serverId })
    setTickets((prev) => [created, ...prev])
    setNotice(t('admin.tickets.created'))
  }

  const handleUpdate = (updated: any) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === updated.id ? { ...ticket, ...updated } : ticket)))
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.tickets.confirmDelete'))) return
    try {
      await edgeFunctions.deleteTicket(id, serverId)
      setTickets((prev) => prev.filter((ticket) => ticket.id !== id))
      setNotice(t('admin.tickets.deleted'))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const columns = [
    { key: 'title', header: t('admin.tickets.titleLabel') },
    {
      key: 'author',
      header: t('admin.tickets.author'),
      render: (ticket: any) => (
        <div css={css({ display: 'flex', alignItems: 'center', gap: 8 })}>
          <Avatar src={ticket.author_avatar} size={24} fallback={(ticket.author_name ?? '?')[0]} />
          {ticket.author_name}
        </div>
      ),
    },
    {
      key: 'category',
      header: t('admin.tickets.categoryLabel'),
      render: (ticket: any) => <Chip label={t(`admin.tickets.category.${ticket.category}`)} size="small" variant="outlined" />,
    },
    {
      key: 'priority',
      header: t('admin.tickets.priorityLabel'),
      render: (ticket: any) => <Chip label={t(`admin.tickets.priority.${ticket.priority}`)} size="small" color={PRIORITY_COLORS[ticket.priority] || undefined} />,
    },
    {
      key: 'status',
      header: t('admin.tickets.statusLabel'),
      render: (ticket: any) => <Chip label={t(`admin.tickets.status.${ticket.status}`)} size="small" color={STATUS_COLORS[ticket.status] || undefined} />,
    },
    {
      key: 'date',
      header: t('admin.tickets.date'),
      render: (ticket: any) => <span css={css({ fontSize: 12, color: 'var(--color-on-surface-muted)' })}>{new Date(ticket.created_at).toLocaleDateString()}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            render: (ticket: any) => (
              <Button
                variant="icon"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(ticket.id) }}
                css={css({ color: 'var(--color-error)' })}
              >
                <Icon name="delete" size={18} />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>
        {t('admin.tickets.title')}
      </h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>
        {t('admin.tickets.desc')}
      </p>

      {notice && <Alert severity="success" onClose={() => setNotice(null)} css={css({ marginBottom: 16 })}>{notice}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)} css={css({ marginBottom: 16 })}>{error}</Alert>}

      <Tabs
        tabs={STATUS_TABS.map((s) => ({ label: t(`admin.tickets.status.${s}`), value: s }))}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      <div css={css({ marginTop: 16 })}>
        {loading ? (
          <div css={css({ display: 'flex', justifyContent: 'center', padding: '48px 0' })}><CircularProgress /></div>
        ) : (
          <>
            <Table
              columns={columns}
              data={tickets}
              keyExtractor={(ticket: any) => ticket.id}
              onRowClick={(ticket: any) => setDetailTicket(ticket)}
            />
            {tickets.length === 0 && (
              <p css={css({ textAlign: 'center', color: 'var(--color-on-surface-muted)', padding: '32px 0' })}>
                {t('admin.tickets.empty')}
              </p>
            )}
          </>
        )}
      </div>

      <Button variant="fab" onClick={() => setCreateOpen(true)}>
        <Icon name="add" />
      </Button>

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

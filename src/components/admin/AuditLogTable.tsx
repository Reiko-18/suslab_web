/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import { Chip, Select, Button, CircularProgress } from '../ui'

interface AuditLog {
  id: string
  created_at: string
  actor_name: string
  action: string
  target_name?: string
  target_id?: string
  details?: unknown
}

interface AuditLogTableProps {
  compact?: boolean
  initialData?: AuditLog[] | null
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  user_ban: { bg: 'var(--color-error)', color: '#fff' },
  user_kick: { bg: 'var(--color-warning)', color: '#000' },
  user_timeout: { bg: 'var(--color-warning)', color: '#000' },
  user_unban: { bg: 'var(--color-success)', color: '#fff' },
  role_change: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  role_create: { bg: 'var(--color-success)', color: '#fff' },
  role_update: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  role_delete: { bg: 'var(--color-error)', color: '#fff' },
  ticket_create: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface)' },
  ticket_update: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
  ticket_delete: { bg: 'var(--color-error)', color: '#fff' },
  setting_update: { bg: 'var(--color-primary)', color: 'var(--color-on-primary)' },
}

export default function AuditLogTable({ compact = false, initialData = null }: AuditLogTableProps) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async (p = 1, filter = '') => {
    setLoading(true)
    try {
      const data = await edgeFunctions.getAuditLog({
        page: p,
        pageSize: compact ? 5 : 20,
        actionFilter: filter || undefined,
      })
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [compact])

  useEffect(() => {
    if (!initialData) {
      fetchLogs(page, actionFilter)
    }
  }, [page, actionFilter, initialData, fetchLogs])

  if (loading) {
    return (
      <div css={css`display: flex; justify-content: center; padding: var(--spacing-6) 0;`}>
        <CircularProgress />
      </div>
    )
  }

  return (
    <>
      {!compact && (
        <div css={css`display: flex; gap: var(--spacing-3); margin-bottom: var(--spacing-3);`}>
          <Select
            label={t('admin.audit.filterAction')}
            value={actionFilter}
            onChange={(value) => { setActionFilter(value); setPage(1) }}
            options={[
              { value: '', label: t('feedback.all') },
              { value: 'user_ban', label: 'Ban' },
              { value: 'user_kick', label: 'Kick' },
              { value: 'user_timeout', label: 'Timeout' },
              { value: 'role_change', label: 'Role Change' },
              { value: 'role_create', label: 'Role Create' },
              { value: 'ticket_update', label: 'Ticket Update' },
              { value: 'setting_update', label: 'Setting Update' },
            ]}
          />
        </div>
      )}

      <div
        css={css`
          overflow-x: auto;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-divider);
        `}
      >
        <table
          css={css`
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          `}
        >
          <thead>
            <tr>
              {[t('admin.audit.time'), t('admin.audit.actor'), t('admin.audit.action'), t('admin.audit.target'), ...(!compact ? [t('admin.audit.details')] : [])].map((header) => (
                <th
                  key={header}
                  css={css`
                    text-align: left;
                    padding: 10px 12px;
                    font-weight: 600;
                    color: var(--color-on-surface-muted);
                    background: var(--color-surface-container);
                    border-bottom: 1px solid var(--color-divider);
                    white-space: nowrap;
                  `}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => {
              const actionColor = ACTION_COLORS[log.action] || { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }
              return (
                <tr
                  key={log.id}
                  css={css`
                    background: ${idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-dim)'};
                    &:hover { background: var(--color-surface-container); }
                  `}
                >
                  <td css={css`padding: 10px 12px; color: var(--color-on-surface); border-bottom: 1px solid var(--color-divider);`}>
                    <span css={css`font-size: 12px;`}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td css={css`padding: 10px 12px; color: var(--color-on-surface); border-bottom: 1px solid var(--color-divider);`}>
                    {log.actor_name}
                  </td>
                  <td css={css`padding: 10px 12px; border-bottom: 1px solid var(--color-divider);`}>
                    <Chip label={log.action} size="small" bg={actionColor.bg} color={actionColor.color} />
                  </td>
                  <td css={css`padding: 10px 12px; color: var(--color-on-surface); border-bottom: 1px solid var(--color-divider);`}>
                    {log.target_name ?? log.target_id}
                  </td>
                  {!compact && (
                    <td css={css`padding: 10px 12px; border-bottom: 1px solid var(--color-divider);`}>
                      <span
                        css={css`
                          font-size: 12px;
                          max-width: 200px;
                          display: block;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          color: var(--color-on-surface-muted);
                        `}
                      >
                        {JSON.stringify(log.details)}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={compact ? 4 : 5}
                  css={css`
                    padding: 16px 12px;
                    text-align: center;
                    color: var(--color-on-surface-muted);
                    border-bottom: 1px solid var(--color-divider);
                  `}
                >
                  {t('admin.audit.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!compact && logs.length >= 20 && (
        <div css={css`display: flex; justify-content: center; margin-top: var(--spacing-3); gap: 8px;`}>
          <Button size="small" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('admin.audit.prev')}
          </Button>
          <Button size="small" variant="ghost" onClick={() => setPage((p) => p + 1)}>
            {t('admin.audit.next')}
          </Button>
        </div>
      )}
    </>
  )
}

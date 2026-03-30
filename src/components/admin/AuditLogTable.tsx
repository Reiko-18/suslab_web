import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../../services/edgeFunctions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'
import type { ChipOwnProps } from '@mui/material/Chip'

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

const ACTION_COLORS: Record<string, ChipOwnProps['color']> = {
  user_ban: 'error',
  user_kick: 'warning',
  user_timeout: 'warning',
  user_unban: 'success',
  role_change: 'info',
  role_create: 'success',
  role_update: 'info',
  role_delete: 'error',
  ticket_create: 'default',
  ticket_update: 'info',
  ticket_delete: 'error',
  setting_update: 'info',
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
      setLogs(data ?? [])
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
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
  }

  return (
    <>
      {!compact && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('admin.audit.filterAction')}</InputLabel>
            <Select
              value={actionFilter}
              label={t('admin.audit.filterAction')}
              onChange={(e: SelectChangeEvent<string>) => { setActionFilter(e.target.value); setPage(1) }}
            >
              <MenuItem value="">{t('feedback.all')}</MenuItem>
              <MenuItem value="user_ban">Ban</MenuItem>
              <MenuItem value="user_kick">Kick</MenuItem>
              <MenuItem value="user_timeout">Timeout</MenuItem>
              <MenuItem value="role_change">Role Change</MenuItem>
              <MenuItem value="role_create">Role Create</MenuItem>
              <MenuItem value="ticket_update">Ticket Update</MenuItem>
              <MenuItem value="setting_update">Setting Update</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.audit.time')}</TableCell>
              <TableCell>{t('admin.audit.actor')}</TableCell>
              <TableCell>{t('admin.audit.action')}</TableCell>
              <TableCell>{t('admin.audit.target')}</TableCell>
              {!compact && <TableCell>{t('admin.audit.details')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(log.created_at).toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>{log.actor_name}</TableCell>
                <TableCell>
                  <Chip label={log.action} size="small" color={ACTION_COLORS[log.action] ?? 'default'} />
                </TableCell>
                <TableCell>{log.target_name ?? log.target_id}</TableCell>
                {!compact && (
                  <TableCell>
                    <Typography variant="caption" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {JSON.stringify(log.details)}
                    </Typography>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={compact ? 4 : 5} align="center">
                  <Typography color="text.secondary">{t('admin.audit.empty')}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!compact && logs.length >= 20 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
          <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('admin.audit.prev')}
          </Button>
          <Button size="small" onClick={() => setPage((p) => p + 1)}>
            {t('admin.audit.next')}
          </Button>
        </Box>
      )}
    </>
  )
}

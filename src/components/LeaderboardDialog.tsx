/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Dialog, Avatar, Button } from './ui'

interface LeaderboardRow {
  rank: number
  displayName: string
  avatarUrl?: string
  value: number | string
}

interface LeaderboardDialogProps {
  open: boolean
  onClose: () => void
  title: string
  rows?: LeaderboardRow[]
  valueLabel: string
}

export default function LeaderboardDialog({ open, onClose, title, rows = [], valueLabel }: LeaderboardDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      }
    >
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
              <th
                css={css`
                  text-align: left;
                  padding: 10px 12px;
                  font-weight: 600;
                  color: var(--color-on-surface-muted);
                  background: var(--color-surface-container);
                  border-bottom: 1px solid var(--color-divider);
                `}
              >
                {t('games.rank')}
              </th>
              <th
                css={css`
                  text-align: left;
                  padding: 10px 12px;
                  font-weight: 600;
                  color: var(--color-on-surface-muted);
                  background: var(--color-surface-container);
                  border-bottom: 1px solid var(--color-divider);
                `}
              >
                {t('games.player')}
              </th>
              <th
                css={css`
                  text-align: right;
                  padding: 10px 12px;
                  font-weight: 600;
                  color: var(--color-on-surface-muted);
                  background: var(--color-surface-container);
                  border-bottom: 1px solid var(--color-divider);
                `}
              >
                {valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.rank}
                css={css`
                  background: ${idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-dim)'};
                  &:hover { background: var(--color-surface-container); }
                `}
              >
                <td
                  css={css`
                    padding: 10px 12px;
                    color: var(--color-on-surface);
                    border-bottom: 1px solid var(--color-divider);
                    font-weight: ${row.rank <= 3 ? 700 : 400};
                  `}
                >
                  {row.rank}
                </td>
                <td
                  css={css`
                    padding: 10px 12px;
                    border-bottom: 1px solid var(--color-divider);
                  `}
                >
                  <div css={css`display: flex; align-items: center; gap: 8px;`}>
                    <Avatar src={row.avatarUrl} size={24} />
                    <span css={css`font-size: 14px; color: var(--color-on-surface);`}>{row.displayName}</span>
                  </div>
                </td>
                <td
                  css={css`
                    padding: 10px 12px;
                    text-align: right;
                    font-weight: 600;
                    color: var(--color-on-surface);
                    border-bottom: 1px solid var(--color-divider);
                  `}
                >
                  {row.value}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  css={css`
                    padding: 16px 12px;
                    text-align: center;
                    color: var(--color-on-surface-muted);
                    border-bottom: 1px solid var(--color-divider);
                  `}
                >
                  -
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

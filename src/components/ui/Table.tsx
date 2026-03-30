/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  width?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
}

export default function Table<T>({ columns, data, keyExtractor, onRowClick }: TableProps<T>) {
  return (
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
            {columns.map((col) => (
              <th
                key={col.key}
                css={css`
                  text-align: left;
                  padding: 10px 12px;
                  font-weight: 600;
                  color: var(--color-on-surface-muted);
                  background: var(--color-surface-container);
                  border-bottom: 1px solid var(--color-divider);
                  white-space: nowrap;
                  ${col.width ? `width: ${col.width};` : ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              css={css`
                background: ${idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-dim)'};
                ${onRowClick ? 'cursor: pointer;' : ''}
                &:hover {
                  background: var(--color-surface-container);
                }
              `}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  css={css`
                    padding: 10px 12px;
                    color: var(--color-on-surface);
                    border-bottom: 1px solid var(--color-divider);
                  `}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

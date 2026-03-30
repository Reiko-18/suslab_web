/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

interface Tab {
  label: string
  value: string
}

interface TabsProps {
  tabs: Tab[]
  value: string
  onChange: (value: string) => void
}

export default function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      css={css`
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--color-divider);
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;

        &::-webkit-scrollbar {
          display: none;
        }
      `}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            css={css`
              flex-shrink: 0;
              padding: 10px 16px;
              font-size: 14px;
              font-weight: ${active ? 600 : 400};
              color: ${active ? 'var(--color-primary)' : 'var(--color-on-surface-muted)'};
              background: none;
              border: none;
              border-bottom: 2px solid ${active ? 'var(--color-primary)' : 'transparent'};
              cursor: pointer;
              transition: color 0.15s, border-color 0.15s;
              white-space: nowrap;

              &:hover {
                color: var(--color-on-surface);
              }
            `}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

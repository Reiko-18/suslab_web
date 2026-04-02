/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const triggerStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  max-width: 200px;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`

const iconStyle = css`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 6px);
  object-fit: cover;
  flex-shrink: 0;
`

const iconFallbackStyle = css`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 6px);
  background: var(--md-sys-color-primary, #7C9070);
  color: var(--md-sys-color-on-primary, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
`

const nameStyle = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const chevronStyle = css`
  flex-shrink: 0;
  font-size: 1rem;
  opacity: 0.7;
  font-style: normal;
`

const dropdownStyle = css`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: var(--md-sys-color-surface-container, #2f3136);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  padding: 4px;
  z-index: var(--z-dropdown, 200);
`

const dropdownItemStyle = (isActive: boolean) => css`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  color: inherit;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: ${isActive ? '600' : '400'};
  text-align: left;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`

const wrapperStyle = css`
  position: relative;
  display: flex;
  align-items: center;
`

export default function ServerSelector() {
  const { servers, activeServer, switchServer } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 只有一個伺服器時不顯示選擇器
  if (servers.length <= 1) return null

  const current = servers.find(s => s.id === activeServer) ?? servers[0]

  const handleToggle = () => setOpen(prev => !prev)

  const handleSelect = async (id: string) => {
    await switchServer(id)
    setOpen(false)
  }

  // 點擊外部關閉下拉選單
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={wrapperRef} css={wrapperStyle}>
      <button type="button" css={triggerStyle} onClick={handleToggle} aria-haspopup="listbox" aria-expanded={open}>
        <ServerIcon name={current.name} iconUrl={current.icon_url} />
        <span css={nameStyle}>{current.name}</span>
        <i css={chevronStyle} aria-hidden="true">{open ? '▲' : '▼'}</i>
      </button>

      {open && (
        <div css={dropdownStyle} role="listbox">
          {servers.map(server => (
            <button
              key={server.id}
              type="button"
              role="option"
              aria-selected={server.id === activeServer}
              css={dropdownItemStyle(server.id === activeServer)}
              onClick={() => handleSelect(server.id)}
            >
              <ServerIcon name={server.name} iconUrl={server.icon_url} />
              <span css={nameStyle}>{server.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ServerIcon({ name, iconUrl }: { name: string; iconUrl: string | null }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={name} css={iconStyle} />
  }
  return (
    <span css={iconFallbackStyle} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

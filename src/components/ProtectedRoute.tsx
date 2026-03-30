/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../context/AuthContext'
import { Card, CircularProgress } from './ui'

interface ProtectedRouteProps {
  children?: ReactNode
  minimumRole?: Role
}

export default function ProtectedRoute({ children, minimumRole = 'member' }: ProtectedRouteProps) {
  const { user, loading, hasRole } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        `}
      >
        <CircularProgress />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (!hasRole(minimumRole)) {
    return (
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        `}
      >
        <Card
          css={css`
            text-align: center;
            max-width: 400px;
            padding: var(--spacing-6);
          `}
        >
          <h2
            css={css`
              font-size: 20px;
              font-weight: 700;
              color: var(--color-on-surface);
              margin: 0 0 8px 0;
            `}
          >
            {t('common.noPermission')}
          </h2>
          <p
            css={css`
              font-size: 14px;
              color: var(--color-on-surface-muted);
              margin: 0;
            `}
          >
            {t('common.noPermissionDesc', { role: minimumRole })}
          </p>
        </Card>
      </div>
    )
  }

  return children ?? <Outlet />
}

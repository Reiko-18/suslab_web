/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { CircularProgress } from '../components/ui'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user) {
      navigate('/home', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div css={css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 16,
    })}>
      <CircularProgress />
      <span css={css({ color: 'var(--color-on-surface-muted)' })}>{t('common.loading')}</span>
    </div>
  )
}

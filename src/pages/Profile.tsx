/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { Icon, Button, Card, Chip, Avatar, CircularProgress, Divider } from '../components/ui'
import { Container, Stack } from '../components/layout'
import ProfileEditor from '../components/ProfileEditor'

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { user, role, loading, signOut } = useAuth()
  const [profileData, setProfileData] = useState<any>(null)

  useEffect(() => {
    if (user) {
      edgeFunctions.getOwnProfile().then(setProfileData).catch(console.error)
    }
  }, [user])

  if (loading) {
    return (
      <div css={css({ display: 'flex', justifyContent: 'center', padding: '80px 0' })}>
        <CircularProgress />
      </div>
    )
  }

  if (!user) return null

  const meta = user.user_metadata || {}
  const avatar: string | undefined = meta.avatar_url
  const displayName: string = meta.full_name || meta.user_name || meta.name || 'User'
  const username: string | undefined = meta.user_name || meta.preferred_username
  const email: string | undefined = profileData?.email ?? meta.email ?? user.email
  const displayRole: string | null = profileData?.role ?? role
  const createdAt: string = new Date(user.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Container maxWidth="md" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <Card css={css({ overflow: 'hidden' })}>
        <div css={css({
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, var(--color-primary)))',
          padding: 32,
          textAlign: 'center',
        })}>
          <Avatar
            src={avatar}
            fallback={displayName[0]?.toUpperCase()}
            size={80}
            css={css({ margin: '0 auto 8px', border: '3px solid white' })}
          />
          <h2 css={css({ color: 'white', fontWeight: 700, fontSize: 22, margin: '0 0 4px' })}>{displayName}</h2>
          {username && <p css={css({ color: 'rgba(255,255,255,0.8)', margin: 0 })}>@{username}</p>}
        </div>
        <div css={css({ padding: 24 })}>
          <Stack gap={16}>
            <div css={css({ display: 'flex', alignItems: 'center', gap: 12 })}>
              <Icon name="shield" size={22} css={css({ color: 'var(--color-primary)' })} />
              <span>{t('profile.role')}</span>
              <Chip label={t(`profile.roles.${displayRole}`) || displayRole || ''} size="small" css={css({ marginLeft: 'auto' })} />
            </div>
            <Divider />
            {email && (
              <div css={css({ display: 'flex', alignItems: 'center', gap: 12 })}>
                <Icon name="email" size={22} css={css({ color: 'var(--color-on-surface-dim)' })} />
                <span>{email}</span>
              </div>
            )}
            <div css={css({ display: 'flex', alignItems: 'center', gap: 12 })}>
              <Icon name="calendar_month" size={22} css={css({ color: 'var(--color-on-surface-dim)' })} />
              <span>{t('profile.joinDate')}: {createdAt}</span>
            </div>
            <div css={css({ display: 'flex', alignItems: 'center', gap: 12 })}>
              <Icon name="verified" size={22} css={css({ color: 'var(--color-on-surface-dim)' })} />
              <span>{t('profile.verifiedVia')}</span>
            </div>
          </Stack>
          <Button
            variant="secondary"
            startIcon="logout"
            fullWidth
            onClick={signOut}
            css={css({ marginTop: 24, color: 'var(--color-error)' })}
          >
            {t('profile.logout')}
          </Button>
        </div>
      </Card>

      <ProfileEditor />
    </Container>
  )
}

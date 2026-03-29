import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LogoutIcon from '@mui/icons-material/Logout'
import VerifiedIcon from '@mui/icons-material/Verified'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EmailIcon from '@mui/icons-material/Email'
import ShieldIcon from '@mui/icons-material/Shield'
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
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <Box sx={{ background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, p: 4, textAlign: 'center' }}>
          <Avatar src={avatar} sx={{ width: 80, height: 80, mx: 'auto', mb: 1, border: '3px solid white', fontSize: 32 }}>
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>{displayName}</Typography>
          {username && <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>@{username}</Typography>}
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ShieldIcon color="primary" />
              <Typography>{t('profile.role')}</Typography>
              <Chip label={t(`profile.roles.${displayRole}`) || displayRole} size="small" color="primary" sx={{ ml: 'auto' }} />
            </Box>
            <Divider />
            {email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <EmailIcon color="action" /><Typography>{email}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CalendarMonthIcon color="action" /><Typography>{t('profile.joinDate')}: {createdAt}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <VerifiedIcon color="action" /><Typography>{t('profile.verifiedVia')}</Typography>
            </Box>
          </Stack>
          <Button variant="outlined" color="error" startIcon={<LogoutIcon />} fullWidth sx={{ mt: 3 }} onClick={signOut}>
            {t('profile.logout')}
          </Button>
        </CardContent>
      </Card>

      <ProfileEditor />
    </Container>
  )
}

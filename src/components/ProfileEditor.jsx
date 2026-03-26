import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import XIcon from '@mui/icons-material/X'
import GitHubIcon from '@mui/icons-material/GitHub'
import YouTubeIcon from '@mui/icons-material/YouTube'
import BrushIcon from '@mui/icons-material/Brush'
import LinkIcon from '@mui/icons-material/Link'
import SaveIcon from '@mui/icons-material/Save'

const SKILL_PRESETS = [
  'Gaming',
  'Music Production',
  'Digital Art',
  'Video Editing',
  'Programming',
  'Streaming',
  'Writing',
  'Photography',
  '3D Modeling',
  'UI/UX Design',
]

const SOCIAL_FIELDS = [
  { key: 'twitter', icon: XIcon, label: 'Twitter / X' },
  { key: 'github', icon: GitHubIcon, label: 'GitHub' },
  { key: 'pixiv', icon: BrushIcon, label: 'Pixiv' },
  { key: 'youtube', icon: YouTubeIcon, label: 'YouTube' },
  { key: 'other', icon: LinkIcon, label: 'Other' },
]

const VISIBILITY_FIELDS = [
  'avatar',
  'bio',
  'email',
  'role',
  'join_date',
  'skill_tags',
  'social_links',
]

export default function ProfileEditor() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [skillTags, setSkillTags] = useState([])
  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    github: '',
    pixiv: '',
    youtube: '',
    other: '',
  })
  const [visibility, setVisibility] = useState({
    bio: true,
    email: true,
    skill_tags: true,
    social_links: true,
    avatar: true,
    role: true,
    join_date: true,
  })
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const data = await edgeFunctions.getOwnProfile()
        setBio(data.bio ?? '')
        setSkillTags(data.skill_tags ?? [])
        setSocialLinks({
          twitter: data.social_links?.twitter ?? '',
          github: data.social_links?.github ?? '',
          pixiv: data.social_links?.pixiv ?? '',
          youtube: data.social_links?.youtube ?? '',
          other: data.social_links?.other ?? '',
        })
        setVisibility({
          bio: data.visibility?.bio ?? true,
          email: data.visibility?.email ?? true,
          skill_tags: data.visibility?.skill_tags ?? true,
          social_links: data.visibility?.social_links ?? true,
          avatar: data.visibility?.avatar ?? true,
          role: data.visibility?.role ?? true,
          join_date: data.visibility?.join_date ?? true,
        })
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Filter out empty social link values
      const filteredLinks = {}
      for (const [key, val] of Object.entries(socialLinks)) {
        if (val.trim()) {
          filteredLinks[key] = val.trim()
        }
      }

      await edgeFunctions.updateProfile({
        bio,
        skill_tags: skillTags,
        social_links: filteredLinks,
        visibility,
      })
      setSnackbar({ open: true, severity: 'success', message: t('profile.saved') })
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSnackbar({ open: true, severity: 'error', message: t('profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const handleSocialChange = (key, value) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  const handleVisibilityChange = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {t('profile.editCard')}
        </Typography>

        {/* Bio */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.bio')}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('profile.bioPlaceholder')}
          inputProps={{ maxLength: 500 }}
          helperText={`${bio.length}/500`}
          sx={{ mb: 2 }}
        />

        {/* Skill Tags */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.skillTags')}
        </Typography>
        <Autocomplete
          multiple
          freeSolo
          options={SKILL_PRESETS}
          value={skillTags}
          onChange={(_, newValue) => {
            if (newValue.length <= 10) {
              setSkillTags(newValue)
            }
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder={t('profile.skillTags')} />
          )}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />

        {/* Social Links */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {t('profile.socialLinks')}
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {SOCIAL_FIELDS.map((field) => (
            <Box key={field.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <field.icon color="action" sx={{ fontSize: 20 }} />
              <TextField
                size="small"
                fullWidth
                label={field.label}
                value={socialLinks[field.key]}
                onChange={(e) => handleSocialChange(field.key, e.target.value)}
                inputProps={{ maxLength: 200 }}
              />
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Visibility */}
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {t('profile.visibility')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('profile.visibilityDesc')}
        </Typography>
        <Stack spacing={0}>
          {VISIBILITY_FIELDS.map((field) => {
            const fieldKey = field === 'join_date' ? 'joinDate' : field === 'skill_tags' ? 'skillTags' : field === 'social_links' ? 'socialLinks' : field
            return (
              <FormControlLabel
                key={field}
                control={
                  <Switch
                    checked={visibility[field]}
                    onChange={() => handleVisibilityChange(field)}
                    size="small"
                  />
                }
                label={t(`profile.fields.${fieldKey}`)}
              />
            )
          })}
        </Stack>

        {/* Save */}
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          fullWidth
          sx={{ mt: 3 }}
        >
          {t('profile.save')}
        </Button>
      </CardContent>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  )
}

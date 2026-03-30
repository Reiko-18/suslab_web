/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import { Card, TextField, Switch, Button, Snackbar, Icon, Divider, CircularProgress } from './ui'
import { Stack } from './layout'

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

interface SocialField {
  key: string
  icon: string
  label: string
}

const SOCIAL_FIELDS: SocialField[] = [
  { key: 'twitter', icon: 'x', label: 'Twitter / X' },
  { key: 'github', icon: 'github', label: 'GitHub' },
  { key: 'pixiv', icon: 'brush', label: 'Pixiv' },
  { key: 'youtube', icon: 'youtube', label: 'YouTube' },
  { key: 'other', icon: 'link', label: 'Other' },
]

const VISIBILITY_FIELDS = [
  'avatar',
  'bio',
  'email',
  'role',
  'join_date',
  'skill_tags',
  'social_links',
] as const

type VisibilityField = typeof VISIBILITY_FIELDS[number]

interface SocialLinks {
  twitter: string
  github: string
  pixiv: string
  youtube: string
  other: string
}

interface Visibility {
  bio: boolean
  email: boolean
  skill_tags: boolean
  social_links: boolean
  avatar: boolean
  role: boolean
  join_date: boolean
}

type SnackSeverity = 'success' | 'error' | 'warning' | 'info'

interface SnackbarState {
  open: boolean
  severity: SnackSeverity
  message: string
}

export default function ProfileEditor() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bio, setBio] = useState('')
  const [skillTags, setSkillTags] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    twitter: '',
    github: '',
    pixiv: '',
    youtube: '',
    other: '',
  })
  const [visibility, setVisibility] = useState<Visibility>({
    bio: true,
    email: true,
    skill_tags: true,
    social_links: true,
    avatar: true,
    role: true,
    join_date: true,
  })
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, severity: 'success', message: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const data = await edgeFunctions.getOwnProfile() as {
          bio?: string
          skill_tags?: string[]
          social_links?: Partial<SocialLinks>
          visibility?: Partial<Visibility>
        }
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
      const filteredLinks: Partial<SocialLinks> = {}
      for (const [key, val] of Object.entries(socialLinks)) {
        if (val.trim()) {
          filteredLinks[key as keyof SocialLinks] = val.trim()
        }
      }

      await edgeFunctions.updateProfile({
        bio,
        skill_tags: skillTags,
        social_links: filteredLinks as Record<string, string>,
        visibility: visibility as unknown as string,
      })
      setSnackbar({ open: true, severity: 'success', message: t('profile.saved') })
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSnackbar({ open: true, severity: 'error', message: t('profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const handleSocialChange = (key: string, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  const handleVisibilityChange = (key: VisibilityField) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleAddSkillTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !skillTags.includes(trimmed) && skillTags.length < 10) {
      setSkillTags((prev) => [...prev, trimmed])
    }
    setSkillInput('')
  }

  const handleRemoveSkillTag = (tag: string) => {
    setSkillTags((prev) => prev.filter((t) => t !== tag))
  }

  if (loading) {
    return (
      <Card css={css`margin-top: var(--spacing-4);`}>
        <div css={css`display: flex; justify-content: center; padding: var(--spacing-6) 0;`}>
          <CircularProgress />
        </div>
      </Card>
    )
  }

  return (
    <Card css={css`margin-top: var(--spacing-4);`}>
      <h3 css={css`font-size: 18px; font-weight: 700; color: var(--color-on-surface); margin: 0 0 16px 0;`}>
        {t('profile.editCard')}
      </h3>

      {/* Bio */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
        {t('profile.bio')}
      </p>
      <TextField
        fullWidth
        multiline
        rows={3}
        value={bio}
        onChange={(e) => setBio((e.target as HTMLTextAreaElement).value)}
        placeholder={t('profile.bioPlaceholder')}
        helperText={`${bio.length}/500`}
      />

      {/* 技能標籤 */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 16px 0 4px 0;`}>
        {t('profile.skillTags')}
      </p>
      <div css={css`display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;`}>
        {skillTags.map((tag) => (
          <span
            key={tag}
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              padding: 2px 8px;
              border-radius: var(--radius-full);
              background: var(--color-surface-container);
              color: var(--color-on-surface);
            `}
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveSkillTag(tag)}
              css={css`
                display: inline-flex;
                padding: 0;
                border: none;
                background: none;
                cursor: pointer;
                color: var(--color-on-surface-muted);
                &:hover { color: var(--color-error); }
              `}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
      </div>
      <div css={css`position: relative;`}>
        <TextField
          fullWidth
          value={skillInput}
          onChange={(e) => setSkillInput((e.target as HTMLInputElement).value)}
          placeholder={t('profile.skillTags')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddSkillTag(skillInput)
            }
          }}
        />
        {/* datalist 建議 */}
        {skillInput && (
          <div
            css={css`
              position: absolute;
              top: 100%;
              left: 0;
              right: 0;
              z-index: var(--z-dropdown);
              background: var(--color-surface);
              border: 1px solid var(--color-divider);
              border-radius: var(--radius-sm);
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
              max-height: 160px;
              overflow-y: auto;
            `}
          >
            {SKILL_PRESETS.filter(
              (p) =>
                p.toLowerCase().includes(skillInput.toLowerCase()) &&
                !skillTags.includes(p),
            ).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAddSkillTag(preset)}
                css={css`
                  display: block;
                  width: 100%;
                  padding: 8px 12px;
                  text-align: left;
                  border: none;
                  background: none;
                  cursor: pointer;
                  font-size: 13px;
                  color: var(--color-on-surface);
                  &:hover { background: var(--color-surface-container); }
                `}
              >
                {preset}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider spacing="var(--spacing-4)" />

      {/* 社交連結 */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 8px 0;`}>
        {t('profile.socialLinks')}
      </p>
      <Stack gap="var(--spacing-2)">
        {SOCIAL_FIELDS.map((field) => (
          <div key={field.key} css={css`display: flex; align-items: center; gap: 8px;`}>
            <Icon name={field.icon} size={20} style={{ color: 'var(--color-on-surface-dim)', flexShrink: 0 }} />
            <TextField
              fullWidth
              label={field.label}
              value={socialLinks[field.key as keyof SocialLinks]}
              onChange={(e) => handleSocialChange(field.key, (e.target as HTMLInputElement).value)}
            />
          </div>
        ))}
      </Stack>

      <Divider spacing="var(--spacing-4)" />

      {/* 公開設定 */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
        {t('profile.visibility')}
      </p>
      <p css={css`font-size: 13px; color: var(--color-on-surface-muted); margin: 0 0 8px 0;`}>
        {t('profile.visibilityDesc')}
      </p>
      <Stack gap={0}>
        {VISIBILITY_FIELDS.map((field) => {
          const fieldKey = field === 'join_date' ? 'joinDate' : field === 'skill_tags' ? 'skillTags' : field === 'social_links' ? 'socialLinks' : field
          return (
            <Switch
              key={field}
              checked={visibility[field]}
              onChange={() => handleVisibilityChange(field)}
              label={t(`profile.fields.${fieldKey}`)}
            />
          )
        })}
      </Stack>

      {/* 儲存按鈕 */}
      <Button
        variant="primary"
        fullWidth
        onClick={handleSave}
        disabled={saving}
        startIcon={saving ? undefined : 'save'}
        css={css`margin-top: var(--spacing-4);`}
      >
        {saving && <CircularProgress size={18} color="var(--color-on-primary)" />}
        {t('profile.save')}
      </Button>

      <Snackbar
        open={snackbar.open}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
        autoHideDuration={4000}
      />
    </Card>
  )
}

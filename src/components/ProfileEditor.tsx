/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import { Card, TextField, Switch, Button, Snackbar, Icon, Divider, CircularProgress } from './ui'
import { Stack } from './layout'

// ── Skill tag presets ──────────────────────────────────────────────────────────
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

// ── Social link fields ─────────────────────────────────────────────────────────
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

// ── Visibility presets ─────────────────────────────────────────────────────────
type VisibilityFields = {
  bio: boolean
  skill_tags: boolean
  social_links: boolean
  email: boolean
  discord_id: boolean
  xp_level: boolean
  badges: boolean
  joined_servers: boolean
}

const VISIBILITY_FIELD_KEYS: (keyof VisibilityFields)[] = [
  'bio',
  'skill_tags',
  'social_links',
  'email',
  'discord_id',
  'xp_level',
  'badges',
  'joined_servers',
]

const PRESETS: Record<string, VisibilityFields> = {
  public: {
    bio: true,
    skill_tags: true,
    social_links: true,
    email: true,
    discord_id: true,
    xp_level: true,
    badges: true,
    joined_servers: true,
  },
  members_only: {
    bio: true,
    skill_tags: true,
    social_links: true,
    email: false,
    discord_id: true,
    xp_level: true,
    badges: true,
    joined_servers: false,
  },
  private: {
    bio: false,
    skill_tags: false,
    social_links: false,
    email: false,
    discord_id: false,
    xp_level: false,
    badges: false,
    joined_servers: false,
  },
}

type PresetKey = keyof typeof PRESETS | 'custom'

function detectPreset(fields: VisibilityFields): PresetKey {
  for (const [key, preset] of Object.entries(PRESETS) as [PresetKey, VisibilityFields][]) {
    if (VISIBILITY_FIELD_KEYS.every((f) => preset[f] === fields[f])) return key
  }
  return 'custom'
}

// ── Legacy fields kept for backward-compat with old visibility data ────────────
interface LegacyVisibility {
  avatar?: boolean
  role?: boolean
  join_date?: boolean
}

interface SocialLinks {
  twitter: string
  github: string
  pixiv: string
  youtube: string
  other: string
}

type SnackSeverity = 'success' | 'error' | 'warning' | 'info'

interface SnackbarState {
  open: boolean
  severity: SnackSeverity
  message: string
}

// ── Component ─────────────────────────────────────────────────────────────────
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

  const [visibilityFields, setVisibilityFields] = useState<VisibilityFields>(PRESETS.public)
  const [preset, setPreset] = useState<PresetKey>('public')

  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, severity: 'success', message: '' })

  // Load profile
  useEffect(() => {
    const load = async () => {
      try {
        const data = await edgeFunctions.getOwnProfile() as {
          bio?: string
          skill_tags?: string[]
          social_links?: Partial<SocialLinks>
          visibility?: Partial<VisibilityFields & LegacyVisibility> | { preset?: string; fields?: Partial<VisibilityFields> }
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

        // Support both new format { preset, fields } and legacy flat format
        let loadedFields: VisibilityFields = { ...PRESETS.public }
        const vis = data.visibility as any
        if (vis?.fields && typeof vis.fields === 'object') {
          // New format
          loadedFields = { ...PRESETS.public, ...vis.fields }
        } else if (vis && typeof vis === 'object') {
          // Legacy flat format — map known keys
          loadedFields = {
            bio: vis.bio ?? true,
            skill_tags: vis.skill_tags ?? true,
            social_links: vis.social_links ?? true,
            email: vis.email ?? true,
            discord_id: vis.discord_id ?? true,
            xp_level: vis.xp_level ?? true,
            badges: vis.badges ?? true,
            joined_servers: vis.joined_servers ?? true,
          }
        }

        setVisibilityFields(loadedFields)
        setPreset(detectPreset(loadedFields))
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const filteredLinks: Partial<SocialLinks> = {}
      for (const [key, val] of Object.entries(socialLinks)) {
        if (val.trim()) filteredLinks[key as keyof SocialLinks] = val.trim()
      }

      await edgeFunctions.updateProfile({
        bio,
        skill_tags: skillTags,
        social_links: filteredLinks as Record<string, string>,
        visibility: JSON.stringify({ preset, fields: visibilityFields }),
      })
      setSnackbar({ open: true, severity: 'success', message: t('profile.saved') })
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSnackbar({ open: true, severity: 'error', message: t('profile.saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  // ── Social link change ──────────────────────────────────────────────────────
  const handleSocialChange = (key: string, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  // ── Skill tag helpers ───────────────────────────────────────────────────────
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

  // ── Visibility preset selection ─────────────────────────────────────────────
  const handlePresetChange = (newPreset: PresetKey) => {
    setPreset(newPreset)
    if (newPreset !== 'custom' && PRESETS[newPreset]) {
      setVisibilityFields({ ...PRESETS[newPreset] })
    }
  }

  // ── Individual toggle change → auto-detect preset ──────────────────────────
  const handleFieldToggle = (field: keyof VisibilityFields) => {
    setVisibilityFields((prev) => {
      const next = { ...prev, [field]: !prev[field] }
      setPreset(detectPreset(next))
      return next
    })
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

  const ALL_PRESETS: PresetKey[] = ['public', 'members_only', 'private', 'custom']

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

      {/* Skill tags */}
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

      {/* Social links */}
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

      {/* Visibility section */}
      <p css={css`font-size: 13px; font-weight: 600; color: var(--color-on-surface); margin: 0 0 4px 0;`}>
        {t('profile.visibility')}
      </p>
      <p css={css`font-size: 13px; color: var(--color-on-surface-muted); margin: 0 0 12px 0;`}>
        {t('profile.visibilityDesc')}
      </p>

      {/* Preset selector pills */}
      <div css={css`
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      `}>
        {ALL_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePresetChange(p)}
            css={css`
              padding: 6px 14px;
              border-radius: var(--radius-full);
              border: 1.5px solid ${preset === p ? 'var(--md-sys-color-primary, var(--color-primary))' : 'var(--color-divider)'};
              background: ${preset === p ? 'var(--md-sys-color-primary-container, var(--color-surface-container))' : 'transparent'};
              color: ${preset === p ? 'var(--md-sys-color-on-primary-container, var(--color-on-surface))' : 'var(--color-on-surface-muted)'};
              font-size: 13px;
              font-weight: ${preset === p ? 600 : 400};
              cursor: ${p === 'custom' && preset !== 'custom' ? 'not-allowed' : 'pointer'};
              opacity: ${p === 'custom' && preset !== 'custom' ? 0.45 : 1};
              transition: all 0.15s;
            `}
            disabled={p === 'custom' && preset !== 'custom'}
            title={p === 'custom' && preset !== 'custom' ? t('profile.visibilityPreset.custom') : undefined}
          >
            {t(`profile.visibilityPreset.${p}`)}
          </button>
        ))}
      </div>

      {/* Per-field toggles */}
      <Stack gap={0}>
        {VISIBILITY_FIELD_KEYS.map((field) => {
          // Map field key to i18n key
          const i18nKey = field === 'skill_tags'
            ? 'skillTags'
            : field === 'social_links'
            ? 'socialLinks'
            : field === 'discord_id'
            ? 'discord_id'
            : field === 'xp_level'
            ? 'xp_level'
            : field === 'joined_servers'
            ? 'joined_servers'
            : field

          return (
            <Switch
              key={field}
              checked={visibilityFields[field]}
              onChange={() => handleFieldToggle(field)}
              label={t(`profile.fields.${i18nKey}`)}
            />
          )
        })}
      </Stack>

      {/* Save button */}
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

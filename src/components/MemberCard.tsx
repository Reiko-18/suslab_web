import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'

interface RoleStyle {
  bg: string
  color: string
  border: string
}

const ROLE_COLORS: Record<string, RoleStyle> = {
  admin: { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
  moderator: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  member: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
}

interface Member {
  user_id?: string
  display_name?: string
  avatar_url?: string
  role?: string
  bio?: string
  skill_tags?: string[]
  social_links?: Record<string, string>
  created_at?: string
}

interface MemberCardProps {
  member: Member
  onClick: () => void
}

export default function MemberCard({ member, onClick }: MemberCardProps) {
  const { t } = useTranslation()

  const MAX_TAGS = 2
  const tags = member.skill_tags ?? []
  const visibleTags = tags.slice(0, MAX_TAGS)
  const extraCount = tags.length - MAX_TAGS
  const roleStyle = (member.role && ROLE_COLORS[member.role]) || ROLE_COLORS.member

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      borderRadius: 4, boxShadow: 'none',
      border: '1px solid', borderColor: 'divider',
      transition: 'all 0.2s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        borderColor: 'primary.main',
      },
    }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ textAlign: 'center', flexGrow: 1, py: 3, px: 2 }}>
          <Avatar
            src={member.avatar_url}
            sx={{
              width: 72, height: 72, mx: 'auto', mb: 2,
              fontSize: 28, fontWeight: 700,
              border: '3px solid', borderColor: 'divider',
            }}
          >
            {(member.display_name || 'U')[0]?.toUpperCase()}
          </Avatar>
          <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5, color: 'text.primary' }}>
            {member.display_name}
          </Typography>
          {member.role && (
            <Chip
              label={t(`profile.roles.${member.role}`)}
              size="small"
              sx={{
                mt: 0.5, fontWeight: 600, fontSize: 11,
                bgcolor: roleStyle.bg, color: roleStyle.color,
                border: '1px solid', borderColor: roleStyle.border,
              }}
            />
          )}
          {member.bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1.5, fontSize: 12, lineHeight: 1.5,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}
            >
              {member.bio}
            </Typography>
          )}
          {visibleTags.length > 0 && (
            <Stack direction="row" sx={{ mt: 1.5, justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              {visibleTags.map((tag) => (
                <Chip
                  key={tag} label={tag} size="small"
                  sx={{
                    fontSize: 11, height: 22,
                    bgcolor: 'action.hover', border: 'none',
                  }}
                />
              ))}
              {extraCount > 0 && (
                <Chip
                  label={t('members.skillsMore', { count: extraCount })}
                  size="small"
                  sx={{ fontSize: 11, height: 22, bgcolor: 'action.hover', border: 'none' }}
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

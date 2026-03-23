import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

export default function MemberCard({ member, onClick }) {
  const { t } = useTranslation()

  const MAX_TAGS = 3
  const tags = member.skill_tags ?? []
  const visibleTags = tags.slice(0, MAX_TAGS)
  const extraCount = tags.length - MAX_TAGS

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardContent sx={{ textAlign: 'center', flexGrow: 1 }}>
          <Avatar
            src={member.avatar_url}
            sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5, fontSize: 28 }}
          >
            {(member.display_name || 'U')[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {member.display_name}
          </Typography>
          {member.role && (
            <Chip
              label={t(`profile.roles.${member.role}`)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          )}
          {member.bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.bio}
            </Typography>
          )}
          {visibleTags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              {visibleTags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
              {extraCount > 0 && (
                <Chip
                  label={t('members.skillsMore', { count: extraCount })}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PushPinIcon from '@mui/icons-material/PushPin'

export default function AnnouncementCard({ announcement, onEdit, onDelete, canManage, canDelete }) {
  const { t, i18n } = useTranslation()

  const timeAgo = new Date(announcement.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {announcement.title}
              </Typography>
              {announcement.pinned && (
                <Chip
                  icon={<PushPinIcon sx={{ fontSize: 16 }} />}
                  label={t('announcements.pinned')}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography
              variant="body1"
              sx={{ whiteSpace: 'pre-wrap', mb: 2 }}
            >
              {announcement.content}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar
                src={announcement.author_avatar_url}
                sx={{ width: 24, height: 24, fontSize: 12 }}
              >
                {(announcement.author_display_name || 'U')[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {announcement.author_display_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {timeAgo}
              </Typography>
            </Stack>
          </Box>
          {(canManage || canDelete) && (
            <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
              {canManage && (
                <IconButton size="small" onClick={() => onEdit(announcement)} title={t('announcements.edit')}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {canDelete && (
                <IconButton size="small" onClick={() => onDelete(announcement)} title={t('announcements.delete')}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined'
import DeleteIcon from '@mui/icons-material/Delete'

type CategoryColor = 'primary' | 'secondary' | 'error' | 'default'

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  feature: 'primary',
  event: 'secondary',
  bug: 'error',
}

const STATUS_LIST = ['open', 'reviewed', 'accepted', 'rejected']

interface Feedback {
  id: string
  author_id: string
  author_display_name?: string
  author_avatar_url?: string
  category: string
  status: string
  title: string
  content: string
  vote_count: number
  has_voted: boolean
  created_at: string
}

interface FeedbackCardProps {
  feedback: Feedback
  userId: string
  isModerator: boolean
  onVote: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

export default function FeedbackCard({ feedback, userId, isModerator, onVote, onStatusChange, onDelete }: FeedbackCardProps) {
  const { t } = useTranslation()
  const isAuthor = feedback.author_id === userId

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={t(`feedback.${feedback.category}`)}
            size="small"
            color={CATEGORY_COLORS[feedback.category] || 'default'}
          />
          <Chip label={t(`feedback.status.${feedback.status}`)} size="small" variant="outlined" />
        </Box>

        <Typography variant="h6" gutterBottom>{feedback.title}</Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {feedback.content}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar src={feedback.author_avatar_url} sx={{ width: 24, height: 24 }} />
            <Typography variant="caption" color="text.secondary">{feedback.author_display_name}</Typography>
            <Typography variant="caption" color="text.disabled">
              {new Date(feedback.created_at).toLocaleDateString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => onVote(feedback.id)} color={feedback.has_voted ? 'primary' : 'default'}>
                {feedback.has_voted ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
              </IconButton>
              <Typography variant="body2">{t('feedback.votes', { count: feedback.vote_count })}</Typography>
            </Box>

            {isModerator && (
              <Select
                value={feedback.status}
                onChange={(e: SelectChangeEvent) => onStatusChange(feedback.id, e.target.value)}
                size="small"
                variant="outlined"
                sx={{ minWidth: 120, height: 32 }}
              >
                {STATUS_LIST.map((s) => (
                  <MenuItem key={s} value={s}>{t(`feedback.status.${s}`)}</MenuItem>
                ))}
              </Select>
            )}

            {isAuthor && (
              <IconButton size="small" color="error" onClick={() => onDelete(feedback.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

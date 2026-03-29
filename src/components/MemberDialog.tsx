import { useState, useEffect, useCallback, ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import XIcon from '@mui/icons-material/X'
import GitHubIcon from '@mui/icons-material/GitHub'
import YouTubeIcon from '@mui/icons-material/YouTube'
import LinkIcon from '@mui/icons-material/Link'
import BrushIcon from '@mui/icons-material/Brush'

const SOCIAL_ICONS: Record<string, ElementType> = {
  twitter: XIcon,
  github: GitHubIcon,
  youtube: YouTubeIcon,
  pixiv: BrushIcon,
  other: LinkIcon,
}

interface Comment {
  id: string
  content: string
  author_display_name: string
  author_avatar_url?: string
  created_at: string
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

interface MemberDialogProps {
  member: Member | null
  open: boolean
  onClose: () => void
}

export default function MemberDialog({ member, open, onClose }: MemberDialogProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [posting, setPosting] = useState(false)

  const isProfileOwner = user?.id === member?.user_id

  const loadComments = useCallback(async () => {
    if (!member?.user_id) return
    setLoadingComments(true)
    try {
      const result = await edgeFunctions.listComments(member.user_id)
      setComments(result.comments ?? [])
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setLoadingComments(false)
    }
  }, [member?.user_id])

  useEffect(() => {
    if (open && member?.user_id) {
      loadComments()
    }
    if (!open) {
      setComments([])
      setCommentText('')
    }
  }, [open, member?.user_id, loadComments])

  const handlePostComment = async () => {
    if (!commentText.trim() || !member?.user_id) return
    setPosting(true)
    try {
      await edgeFunctions.createComment(member.user_id, commentText.trim())
      setCommentText('')
      await loadComments()
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPosting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await edgeFunctions.deleteComment(commentId)
      await loadComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  if (!member) return null

  const socialLinks = member.social_links ?? {}
  const joinDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
        <Avatar
          src={member.avatar_url}
          sx={{ width: 80, height: 80, mx: 'auto', mb: 1, fontSize: 32 }}
        >
          {(member.display_name || 'U')[0]?.toUpperCase()}
        </Avatar>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {member.display_name}
        </Typography>
        {member.role && (
          <Chip
            label={t(`profile.roles.${member.role}`)}
            size="small"
            color="primary"
            sx={{ mt: 0.5 }}
          />
        )}
        {joinDate && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('profile.joinDate')}: {joinDate}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {member.bio && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">{member.bio}</Typography>
          </Box>
        )}

        {(member.skill_tags ?? []).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {t('profile.skillTags')}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {member.skill_tags!.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Stack>
          </Box>
        )}

        {Object.keys(socialLinks).filter((k) => socialLinks[k]).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {t('members.socialLinks')}
            </Typography>
            <Stack direction="row" spacing={1}>
              {Object.entries(socialLinks)
                .filter(([, url]) => url)
                .map(([platform, url]) => {
                  const Icon = SOCIAL_ICONS[platform] || LinkIcon
                  return (
                    <IconButton
                      key={platform}
                      size="small"
                      component="a"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon />
                    </IconButton>
                  )
                })}
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          {t('members.commentWall')}
        </Typography>

        {loadingComments ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            {t('members.noComments')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {comments.map((comment) => (
              <ListItem
                key={comment.id}
                secondaryAction={
                  isProfileOwner ? (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDeleteComment(comment.id)}
                      title={t('members.deleteComment')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  ) : null
                }
                sx={{ px: 0 }}
              >
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar
                    src={comment.author_avatar_url}
                    sx={{ width: 28, height: 28, fontSize: 14 }}
                  >
                    {(comment.author_display_name || 'U')[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={comment.content}
                  secondary={`${comment.author_display_name} — ${new Date(comment.created_at).toLocaleDateString(i18n.language)}`}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('members.writeComment')}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            inputProps={{ maxLength: 500 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handlePostComment()
              }
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handlePostComment}
            disabled={!commentText.trim() || posting}
          >
            {t('members.postComment')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export { OpenInNewIcon as _OpenInNewIcon }

import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import PeopleIcon from '@mui/icons-material/People'

export default function GameInviteCard({ invite, userId, onJoin, onLeave, onClose }) {
  const { t } = useTranslation()
  const isHost = invite.host_id === userId
  const isParticipant = invite.is_participant
  const isClosed = invite.status === 'closed'

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label={invite.game_type} size="small" color="primary" variant="outlined" />
          {isClosed && <Chip label={t('games.invites.closed')} size="small" color="default" />}
        </Box>
        <Typography variant="h6" gutterBottom>{invite.title}</Typography>
        {invite.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {invite.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Avatar src={invite.host_avatar_url} sx={{ width: 20, height: 20 }} />
          <Typography variant="caption" color="text.secondary">{invite.host_display_name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PeopleIcon fontSize="small" color="action" />
          <Typography variant="body2">
            {t('games.invites.players', { current: invite.participant_count, max: invite.max_players })}
          </Typography>
        </Box>
      </CardContent>
      <CardActions>
        {!isClosed && !isHost && !isParticipant && (
          <Button size="small" variant="contained" onClick={() => onJoin(invite.id)}>
            {t('games.invites.join')}
          </Button>
        )}
        {!isClosed && isParticipant && !isHost && (
          <Button size="small" variant="outlined" onClick={() => onLeave(invite.id)}>
            {t('games.invites.leave')}
          </Button>
        )}
        {!isClosed && isHost && (
          <Button size="small" color="warning" variant="outlined" onClick={() => onClose(invite.id)}>
            {t('games.invites.close')}
          </Button>
        )}
      </CardActions>
    </Card>
  )
}

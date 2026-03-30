import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import AddIcon from '@mui/icons-material/Add'
import GameBoard2048 from '../components/GameBoard2048'
import GameInviteCard from '../components/GameInviteCard'
import GameInviteDialog from '../components/GameInviteDialog'
import LeaderboardDialog from '../components/LeaderboardDialog'

interface SnackState {
  severity: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export default function Games() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [snack, setSnack] = useState<SnackState | null>(null)

  const [bestScore, setBestScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [lastGameScore, setLastGameScore] = useState<number | null>(null)

  const [invites, setInvites] = useState<any[]>([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [showCreateInvite, setShowCreateInvite] = useState(false)

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await edgeFunctions.getGameLeaderboard()
      setLeaderboard(data ?? [])
      const myEntry = (data ?? []).find((e: any) => e.user_id === user?.id)
      if (myEntry) setBestScore(myEntry.score)
    } catch { /* ignore */ }
  }, [user?.id])

  const loadInvites = useCallback(async () => {
    try {
      setInvitesLoading(true)
      const data = await edgeFunctions.listGameInvites({ pageSize: 50 })
      setInvites(data.invites ?? [])
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setInvitesLoading(false)
    }
  }, [])

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { if (tab === 1) loadInvites() }, [tab, loadInvites])

  const handleGameOver = async (score: number) => {
    setLastGameScore(score)
    setScoreSubmitted(false)
  }

  const handleSubmitScore = async () => {
    if (lastGameScore == null) return
    try {
      const result = await edgeFunctions.submitGameScore(lastGameScore)
      if (result.saved) {
        setSnack({ severity: 'success', message: t('games.scoreSubmitted') })
        setBestScore(Math.max(bestScore, lastGameScore))
        loadLeaderboard()
      }
      setScoreSubmitted(true)
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleJoin = async (id: string) => {
    try {
      await edgeFunctions.joinGameInvite(id)
      loadInvites()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleLeave = async (id: string) => {
    try {
      await edgeFunctions.leaveGameInvite(id)
      loadInvites()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCloseInvite = async (id: string) => {
    try {
      await edgeFunctions.closeGameInvite(id)
      loadInvites()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleCreateInvite = async (data: any) => {
    try {
      await edgeFunctions.createGameInvite(data)
      loadInvites()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const leaderboardRows = leaderboard.map((e) => ({
    rank: e.rank,
    displayName: e.display_name,
    avatarUrl: e.avatar_url,
    value: e.score,
  }))

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('games.title')}</Typography>

      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('games.tab2048')} />
        <Tab label={t('games.tabInvites')} />
      </Tabs>

      {tab === 0 && (
        <Box>
          <GameBoard2048
            bestScore={bestScore}
            onGameOver={handleGameOver}
            onScoreUpdate={null}
          />

          {lastGameScore != null && !scoreSubmitted && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleSubmitScore}>
                {t('games.submitScore')}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{t('games.leaderboard')}</Typography>
              <Button size="small" onClick={() => setShowLeaderboard(true)}>
                {t('games.leaderboard')}
              </Button>
            </Box>
          </Box>

          <LeaderboardDialog
            open={showLeaderboard}
            onClose={() => setShowLeaderboard(false)}
            title={t('games.leaderboard')}
            rows={leaderboardRows}
            valueLabel={t('games.score')}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ position: 'relative' }}>
          {invitesLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Skeleton variant="rectangular" height={180} />
                </Grid>
              ))}
            </Grid>
          ) : invites.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('games.invites.empty')}</Typography>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {invites.map((invite) => (
                <Grid key={invite.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <GameInviteCard
                    invite={invite}
                    userId={user?.id}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onClose={handleCloseInvite}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          <Fab
            color="primary"
            aria-label={t('games.invites.create')}
            sx={{ position: 'fixed', bottom: 24, right: 24 }}
            onClick={() => setShowCreateInvite(true)}
          >
            <AddIcon />
          </Fab>

          <GameInviteDialog
            open={showCreateInvite}
            onClose={() => setShowCreateInvite(false)}
            onCreate={handleCreateInvite}
          />
        </Box>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}

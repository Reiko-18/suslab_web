/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { Icon, Button, Card, Tabs, Skeleton, Snackbar } from '../components/ui'
import { Container, Grid } from '../components/layout'
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
  const [tab, setTab] = useState('2048')
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
      const list = Array.isArray(data) ? data : []
      setLeaderboard(list)
      const myEntry = list.find((e: any) => e.user_id === user?.id)
      if (myEntry) setBestScore(myEntry.score)
    } catch { /* ignore */ }
  }, [user?.id])

  const loadInvites = useCallback(async () => {
    try {
      setInvitesLoading(true)
      const data = await edgeFunctions.listGameInvites({ pageSize: 50 }) as { invites?: any[] }
      setInvites(data.invites ?? [])
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setInvitesLoading(false)
    }
  }, [])

  useEffect(() => { loadLeaderboard() }, [loadLeaderboard])
  useEffect(() => { if (tab === 'invites') loadInvites() }, [tab, loadInvites])

  const handleGameOver = async (score: number) => {
    setLastGameScore(score)
    setScoreSubmitted(false)
  }

  const handleSubmitScore = async () => {
    if (lastGameScore == null) return
    try {
      const result = await edgeFunctions.submitGameScore(lastGameScore) as { saved?: boolean }
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
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>{t('games.title')}</h1>

      <Tabs
        tabs={[
          { label: t('games.tab2048'), value: '2048' },
          { label: t('games.tabInvites'), value: 'invites' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === '2048' && (
        <div css={css({ marginTop: 24 })}>
          <GameBoard2048
            bestScore={bestScore}
            onGameOver={handleGameOver}
            onScoreUpdate={undefined}
          />

          {lastGameScore != null && !scoreSubmitted && (
            <div css={css({ display: 'flex', justifyContent: 'center', marginTop: 16 })}>
              <Button variant="primary" onClick={handleSubmitScore}>
                {t('games.submitScore')}
              </Button>
            </div>
          )}

          <div css={css({ marginTop: 32 })}>
            <div css={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 })}>
              <h2 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 })}>{t('games.leaderboard')}</h2>
              <Button variant="ghost" size="small" onClick={() => setShowLeaderboard(true)}>
                {t('games.leaderboard')}
              </Button>
            </div>
          </div>

          <LeaderboardDialog
            open={showLeaderboard}
            onClose={() => setShowLeaderboard(false)}
            title={t('games.leaderboard')}
            rows={leaderboardRows}
            valueLabel={t('games.score')}
          />
        </div>
      )}

      {tab === 'invites' && (
        <div css={css({ position: 'relative', marginTop: 24 })}>
          {invitesLoading ? (
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={16}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={180} />
              ))}
            </Grid>
          ) : invites.length === 0 ? (
            <Card css={css({ padding: 32, textAlign: 'center' })}>
              <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('games.invites.empty')}</p>
            </Card>
          ) : (
            <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={16}>
              {invites.map((invite) => (
                <GameInviteCard
                  key={invite.id}
                  invite={invite}
                  userId={user?.id ?? ''}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onClose={handleCloseInvite}
                />
              ))}
            </Grid>
          )}

          <Button variant="fab" onClick={() => setShowCreateInvite(true)} aria-label={t('games.invites.create')}>
            <Icon name="add" />
          </Button>

          <GameInviteDialog
            open={showCreateInvite}
            onClose={() => setShowCreateInvite(false)}
            onCreate={handleCreateInvite}
          />
        </div>
      )}

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        message={snack?.message ?? ''}
      />
    </Container>
  )
}

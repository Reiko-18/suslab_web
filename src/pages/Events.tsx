/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import { useActiveServer } from '../hooks/useActiveServer'
import { Icon, Button, Card, Chip, Skeleton, Snackbar, Avatar } from '../components/ui'
import { Container, Stack, Grid } from '../components/layout'
import LevelCard from '../components/LevelCard'
import LeaderboardDialog from '../components/LeaderboardDialog'

interface SnackState {
  severity: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export default function Events() {
  const { t } = useTranslation()
  const serverId = useActiveServer()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snack, setSnack] = useState<SnackState | null>(null)

  const [levelData, setLevelData] = useState<any>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [registrants, setRegistrants] = useState<Record<string, any[]>>({})

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.getEvents(serverId)
      setEvents(data ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  const loadLevel = useCallback(async () => {
    try {
      const data = await edgeFunctions.getMyLevel()
      setLevelData(data)
    } catch (err) { console.error('Failed to load level:', err) }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadLevel() }, [loadLevel])

  const handleRegister = async (eventId: string) => {
    try {
      await edgeFunctions.registerEvent(eventId)
      setSnack({ severity: 'success', message: t('events.registered') })
      loadEvents()
      loadLevel()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnregister = async (eventId: string) => {
    try {
      await edgeFunctions.unregisterEvent(eventId)
      loadEvents()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggleExpand = async (eventId: string) => {
    const isExpanded = !!expanded[eventId]
    setExpanded((prev) => ({ ...prev, [eventId]: !isExpanded }))

    if (!isExpanded && !registrants[eventId]) {
      try {
        const data = await edgeFunctions.getEventRegistrations(eventId)
        setRegistrants((prev) => ({ ...prev, [eventId]: data ?? [] }))
      } catch (err) { console.error('Failed to load registrations:', err) }
    }
  }

  const handleOpenLeaderboard = async () => {
    try {
      const data = await edgeFunctions.getLevelLeaderboard()
      setLeaderboard(data ?? [])
      setShowLeaderboard(true)
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const leaderboardRows = leaderboard.map((e) => ({
    rank: e.rank,
    displayName: e.display_name,
    avatarUrl: e.avatar_url,
    value: e.xp,
  }))

  return (
    <Container maxWidth="lg" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 8px' })}>{t('events.title')}</h1>
      <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 24px' })}>{t('events.subtitle')}</p>

      {levelData && (
        <LevelCard
          level={levelData.level}
          xp={levelData.xp}
          badges={levelData.badges}
          onLeaderboard={handleOpenLeaderboard}
        />
      )}

      <LeaderboardDialog
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        title={t('levels.leaderboard')}
        rows={leaderboardRows}
        valueLabel="XP"
      />

      {loading ? (
        <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={24}>
          {[1, 2, 3].map((i) => (
            <Card key={i} css={css({ padding: 16 })}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" />
              <Skeleton variant="text" width="40%" />
            </Card>
          ))}
        </Grid>
      ) : error ? (
        <Card css={css({ padding: 32, textAlign: 'center' })}>
          <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('events.loadError')}</p>
        </Card>
      ) : events.length === 0 ? (
        <Card css={css({ padding: 32, textAlign: 'center' })}>
          <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('events.empty')}</p>
        </Card>
      ) : (
        <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap={24}>
          {events.map((event) => (
            <Card key={event.id} css={css({ height: '100%', padding: 16 })}>
              <Chip icon="event" label={event.date} size="small" variant="outlined" />
              <h3 css={css({ fontSize: 18, fontWeight: 600, color: 'var(--color-on-surface)', margin: '8px 0' })}>{event.title}</h3>
              <p css={css({ color: 'var(--color-on-surface-muted)', margin: '0 0 16px', fontSize: 14 })}>{event.description}</p>
              <Stack gap={8}>
                <div css={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
                  <Icon name="schedule" size={18} css={css({ color: 'var(--color-on-surface-dim)' })} />
                  <span css={css({ fontSize: 14 })}>{event.time}</span>
                </div>
                <div css={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
                  <Icon name="location_on" size={18} css={css({ color: 'var(--color-on-surface-dim)' })} />
                  <span css={css({ fontSize: 14 })}>{event.location}</span>
                </div>
                <div css={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
                  <Icon name="group" size={18} css={css({ color: 'var(--color-on-surface-dim)' })} />
                  <span css={css({ fontSize: 14 })}>
                    {t('events.attendees', { count: event.registration_count ?? event.attendees ?? 0 })}
                  </span>
                </div>
              </Stack>

              <div css={css({ marginTop: 16 })}>
                {event.registered ? (
                  <div css={css({ display: 'flex', gap: 8 })}>
                    <Button
                      variant="secondary"
                      size="small"
                      startIcon="check_circle"
                      onClick={() => handleUnregister(event.id)}
                    >
                      {t('events.registered')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => handleRegister(event.id)}
                  >
                    {t('events.register')}
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="small"
                endIcon={expanded[event.id] ? 'expand_less' : 'expand_more'}
                onClick={() => handleToggleExpand(event.id)}
                css={css({ marginTop: 8 })}
              >
                {t('events.registrants')}
              </Button>

              {expanded[event.id] && (
                <div css={css({ marginTop: 8 })}>
                  {registrants[event.id]?.length > 0 ? (
                    <div css={css({ display: 'flex', flexWrap: 'wrap', gap: 0 })}>
                      {registrants[event.id].map((r, idx) => (
                        <Avatar
                          key={r.user_id}
                          src={r.avatar_url}
                          alt={r.display_name}
                          size={28}
                          css={css({ marginLeft: idx > 0 ? -8 : 0, border: '2px solid var(--color-surface)', borderRadius: '50%' })}
                        />
                      ))}
                    </div>
                  ) : (
                    <span css={css({ fontSize: 12, color: 'var(--color-on-surface-muted)' })}>{t('events.noRegistrants')}</span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </Grid>
      )}

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        message={snack?.message ?? ''}
      />
    </Container>
  )
}

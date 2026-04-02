/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { edgeFunctions } from '../services/edgeFunctions'
import { useActiveServer } from '../hooks/useActiveServer'
import { Icon, Button, Skeleton } from '../components/ui'

interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
  pinned?: boolean
  author_name?: string
}

interface EventItem {
  id: string
  title: string
  description: string
  event_date: string
  location?: string
  image_url?: string
}

const CAROUSEL_INTERVAL = 6000
const EVENTS_PER_PAGE = 10

export default function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const serverId = useActiveServer()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loadingAnn, setLoadingAnn] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    edgeFunctions.listAnnouncements({ page: 1, pageSize: 5, server_id: serverId })
      .then((data: { announcements?: Announcement[] }) => setAnnouncements(data.announcements ?? []))
      .catch((err: unknown) => console.error('Failed to load announcements:', err))
      .finally(() => setLoadingAnn(false))

    edgeFunctions.getEvents(serverId)
      .then((data: EventItem[] | { events?: EventItem[] }) => {
        const items = Array.isArray(data) ? data : (data.events ?? [])
        setEvents(items)
      })
      .catch((err: unknown) => console.error('Failed to load events:', err))
      .finally(() => setLoadingEvents(false))
  }, [serverId])

  // Carousel auto-advance
  const carouselItems = announcements.length > 0 ? announcements : []
  const carouselCount = Math.max(carouselItems.length, 1)

  const advanceCarousel = useCallback(() => {
    if (carouselItems.length > 1) {
      setCarouselIndex((prev) => (prev + 1) % carouselCount)
    }
  }, [carouselItems.length, carouselCount])

  useEffect(() => {
    if (carouselItems.length <= 1) return
    const timer = setInterval(advanceCarousel, CAROUSEL_INTERVAL)
    return () => clearInterval(timer)
  }, [advanceCarousel, carouselItems.length])

  // Pagination
  const totalPages = Math.max(Math.ceil(events.length / EVENTS_PER_PAGE), 1)
  const paginatedEvents = events.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  )

  const currentAnn = carouselItems[carouselIndex] ?? null

  // Banner placeholder images (Discord-style winter/event banners)
  const bannerImages = [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1200&h=600&fit=crop',
  ]

  return (
    <div css={css({
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      padding: 5,
      width: '100%',
      boxSizing: 'border-box',
      background: '#2f3136',
      minHeight: '100%',
      borderRadius: 0,
      '@media (min-width: 769px)': { borderRadius: 8 },
    })}>
      {/* Carousel Banner */}
      <div css={css({
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 20,
        overflow: 'hidden',
        flexShrink: 0,
        '@media (min-width: 769px)': { aspectRatio: '2.2/1' },
      })}>
        {loadingAnn ? (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
          />
        ) : (
          <>
            {/* Background image */}
            <img
              src={bannerImages[carouselIndex % bannerImages.length]}
              alt=""
              css={css({
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              })}
            />

            {/* Content overlay */}
            <div css={css({
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              border: '1px solid #292b2f',
              '@media (min-width: 769px)': { padding: 10 },
            })}>
              <h2 css={css({
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: 20,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.35,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                margin: 0,
                '@media (min-width: 600px)': { fontSize: 28 },
                '@media (min-width: 769px)': { fontSize: 40 },
              })}>
                {currentAnn?.title ?? t('home.welcomeBack')}
              </h2>

              <p css={css({
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.6,
                maxHeight: 40,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                margin: 0,
                '@media (min-width: 600px)': { fontSize: 13 },
                '@media (min-width: 769px)': { fontSize: 15, maxHeight: 60, WebkitLineClamp: 3 },
              })}>
                {currentAnn?.content ?? t('landing.hero.subtitle')}
              </p>

              <button
                onClick={() => navigate('/announcements')}
                css={css({
                  background: '#5865f2',
                  color: '#ffffff',
                  fontFamily: '"Whitney Semibold", "Noto Sans", sans-serif',
                  fontSize: 9.5,
                  fontWeight: 600,
                  borderRadius: 2,
                  padding: '5px 11px',
                  minWidth: 'auto',
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  '&:hover': { background: '#4752c4' },
                })}
              >
                {t('home.viewAll')}
              </button>
            </div>

            {/* Carousel indicators */}
            {carouselItems.length > 1 && (
              <div css={css({
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 8,
                zIndex: 2,
              })}>
                {carouselItems.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    css={css({
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: idx === carouselIndex ? '#b9bbbe' : '#4f545c',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      '&:hover': { background: idx === carouselIndex ? '#b9bbbe' : '#72767d' },
                    })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent Event Section */}
      <div css={css({
        background: '#36393f',
        borderRadius: 20,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
      })}>
        {/* Section header */}
        <div css={css({
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        })}>
          <h2 css={css({
            fontFamily: '"Noto Sans", sans-serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#dcddde',
            margin: 0,
          })}>
            {t('home.recentEvent')}
          </h2>

          {/* List/Grid toggle */}
          <div css={css({
            display: 'flex',
            background: '#2f3136',
            borderRadius: 20,
            padding: 6,
            gap: 4,
            marginLeft: 'auto',
          })}>
            <div
              onClick={() => setViewMode('list')}
              css={css({
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: viewMode === 'list' ? '#d9d9d9' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              })}
            >
              <Icon name="view_list" size={18} css={css({ color: viewMode === 'list' ? '#4f5660' : '#b9bbbe' })} />
            </div>
            <div
              onClick={() => setViewMode('grid')}
              css={css({
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: viewMode === 'grid' ? '#d9d9d9' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              })}
            >
              <Icon name="grid_view" size={16} css={css({ color: viewMode === 'grid' ? '#4f5660' : '#b9bbbe' })} />
            </div>
          </div>
        </div>

        {/* Event list */}
        {loadingEvents ? (
          <div css={css({ display: 'flex', flexDirection: 'column', gap: 8 })}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={104}
              />
            ))}
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div css={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 0',
          })}>
            <span css={css({ fontSize: 14, color: '#72767d' })}>
              {t('events.empty')}
            </span>
          </div>
        ) : viewMode === 'list' ? (
          <div css={css({ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 })}>
            {paginatedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate('/events')}
                css={css({
                  display: 'flex',
                  gap: 10,
                  background: '#2f3136',
                  borderRadius: 10,
                  padding: 5,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  '&:hover': { background: '#34373c' },
                })}
              >
                {/* Thumbnail */}
                <div css={css({
                  width: 120,
                  height: 60,
                  flexShrink: 0,
                  borderRadius: 15,
                  overflow: 'hidden',
                  background: '#d9d9d9',
                  '@media (min-width: 600px)': { width: 160, height: 80 },
                  '@media (min-width: 769px)': { width: 188, height: 94 },
                })}>
                  <img
                    src={event.image_url || bannerImages[(events.indexOf(event)) % bannerImages.length]}
                    alt=""
                    css={css({
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    })}
                  />
                </div>

                {/* Event info */}
                <div css={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                  minWidth: 0,
                  justifyContent: 'center',
                })}>
                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 14,
                    fontWeight: 400,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '@media (min-width: 769px)': { fontSize: 20 },
                  })}>
                    {event.title}
                  </span>

                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#dcddde',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  })}>
                    {event.description}
                  </span>

                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#72767d',
                  })}>
                    {new Date(event.event_date).toLocaleString(i18n.language, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {event.location ? `, ${event.location}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div css={css({
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 8,
            flex: 1,
            '@media (min-width: 600px)': { gridTemplateColumns: '1fr 1fr' },
            '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
          })}>
            {paginatedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate('/events')}
                css={css({
                  background: '#2f3136',
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  '&:hover': { background: '#34373c' },
                })}
              >
                <div css={css({
                  width: '100%',
                  aspectRatio: '2/1',
                  overflow: 'hidden',
                })}>
                  <img
                    src={event.image_url || bannerImages[(events.indexOf(event)) % bannerImages.length]}
                    alt=""
                    css={css({ width: '100%', height: '100%', objectFit: 'cover' })}
                  />
                </div>
                <div css={css({ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 })}>
                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  })}>
                    {event.title}
                  </span>
                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 11,
                    color: '#72767d',
                  })}>
                    {new Date(event.event_date).toLocaleString(i18n.language, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div css={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 8,
        })}>
          {/* Per page info */}
          <div css={css({ display: 'flex', alignItems: 'center', gap: 4 })}>
            <div css={css({
              background: '#2f3136',
              borderRadius: 30,
              padding: '2px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}>
              <span css={css({
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: 8,
                color: '#ffffff',
              })}>
                {EVENTS_PER_PAGE}
              </span>
            </div>
            <span css={css({
              fontFamily: '"Noto Sans", sans-serif',
              fontSize: 8,
              color: '#ffffff',
            })}>
              {t('home.perPage')}
            </span>
          </div>

          {/* Page numbers */}
          <div css={css({ display: 'flex', alignItems: 'center', gap: 10 })}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              css={css({
                width: 20,
                height: 20,
                background: currentPage <= 1 ? '#36393f' : '#4f545c',
                borderRadius: '50%',
                color: currentPage <= 1 ? '#4f545c' : '#b9bbbe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                padding: 0,
                '&:hover:not(:disabled)': { background: '#5d6269' },
              })}
            >
              <Icon name="chevron_left" size={14} />
            </button>

            {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => {
              const page = i + 1
              if (totalPages > 4 && i === 3) {
                return (
                  <div key="ellipsis" css={css({
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#4f545c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  })}>
                    <span css={css({ fontSize: 10, color: '#ffffff', fontFamily: '"Noto Sans", sans-serif' })}>
                      ...
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  css={css({
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: currentPage === page ? '#72767d' : '#4f545c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    '&:hover': { background: '#72767d' },
                  })}
                >
                  <span css={css({
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 10,
                    color: '#ffffff',
                  })}>
                    {page}
                  </span>
                </div>
              )
            })}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              css={css({
                width: 20,
                height: 20,
                background: currentPage >= totalPages ? '#36393f' : '#4f545c',
                borderRadius: '50%',
                color: currentPage >= totalPages ? '#4f545c' : '#b9bbbe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                padding: 0,
                '&:hover:not(:disabled)': { background: '#5d6269' },
              })}
            >
              <Icon name="chevron_right" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

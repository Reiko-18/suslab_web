import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { edgeFunctions } from '../services/edgeFunctions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ViewListIcon from '@mui/icons-material/ViewList'
import GridViewIcon from '@mui/icons-material/GridView'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loadingAnn, setLoadingAnn] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    edgeFunctions.listAnnouncements({ page: 1, pageSize: 5 })
      .then((data: { announcements?: Announcement[] }) => setAnnouncements(data.announcements ?? []))
      .catch((err: unknown) => console.error('Failed to load announcements:', err))
      .finally(() => setLoadingAnn(false))

    edgeFunctions.getEvents()
      .then((data: EventItem[] | { events?: EventItem[] }) => {
        const items = Array.isArray(data) ? data : (data.events ?? [])
        setEvents(items)
      })
      .catch((err: unknown) => console.error('Failed to load events:', err))
      .finally(() => setLoadingEvents(false))
  }, [])

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
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      p: '5px',
      width: '100%',
      boxSizing: 'border-box',
      bgcolor: '#2f3136',
      minHeight: '100%',
      borderRadius: { xs: 0, md: '8px' },
    }}>
      {/* Carousel Banner */}
      <Box sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: { xs: '16/9', md: '2.2/1' },
        borderRadius: '20px',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {loadingAnn ? (
          <Skeleton
            variant="rectangular"
            sx={{ width: '100%', height: '100%', bgcolor: '#36393f' }}
          />
        ) : (
          <>
            {/* Background image */}
            <Box
              component="img"
              src={bannerImages[carouselIndex % bannerImages.length]}
              alt=""
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            {/* Content overlay */}
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
              p: { xs: 1.5, md: '10px' },
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid #292b2f',
            }}>
              <Typography sx={{
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: { xs: 20, sm: 28, md: 40 },
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.35,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                {currentAnn?.title ?? t('home.welcomeBack')}
              </Typography>

              <Typography sx={{
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: { xs: 11, sm: 13, md: 15 },
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.6,
                maxHeight: { xs: 40, md: 60 },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: { xs: 2, md: 3 },
                WebkitBoxOrient: 'vertical',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}>
                {currentAnn?.content ?? t('landing.hero.subtitle')}
              </Typography>

              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/announcements')}
                sx={{
                  bgcolor: '#5865f2',
                  color: '#ffffff',
                  fontFamily: '"Whitney Semibold", "Noto Sans", sans-serif',
                  fontSize: 9.5,
                  fontWeight: 600,
                  borderRadius: '2px',
                  px: '11px',
                  py: '5px',
                  minWidth: 'auto',
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#4752c4' },
                }}
              >
                {t('home.viewAll')}
              </Button>
            </Box>

            {/* Carousel indicators */}
            {carouselItems.length > 1 && (
              <Box sx={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                zIndex: 2,
              }}>
                {carouselItems.map((_, idx) => (
                  <Box
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: idx === carouselIndex ? '#b9bbbe' : '#4f545c',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: idx === carouselIndex ? '#b9bbbe' : '#72767d' },
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Recent Event Section */}
      <Box sx={{
        bgcolor: '#36393f',
        borderRadius: '20px',
        p: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
      }}>
        {/* Section header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Typography sx={{
            fontFamily: '"Noto Sans", sans-serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#dcddde',
          }}>
            {t('home.recentEvent')}
          </Typography>

          {/* List/Grid toggle */}
          <Box sx={{
            display: 'flex',
            bgcolor: '#2f3136',
            borderRadius: '20px',
            p: '6px',
            gap: '4px',
            ml: 'auto',
          }}>
            <Box
              onClick={() => setViewMode('list')}
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: viewMode === 'list' ? '#d9d9d9' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <ViewListIcon sx={{ fontSize: 18, color: viewMode === 'list' ? '#4f5660' : '#b9bbbe' }} />
            </Box>
            <Box
              onClick={() => setViewMode('grid')}
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: viewMode === 'grid' ? '#d9d9d9' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <GridViewIcon sx={{ fontSize: 16, color: viewMode === 'grid' ? '#4f5660' : '#b9bbbe' }} />
            </Box>
          </Box>
        </Box>

        {/* Event list */}
        {loadingEvents ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                sx={{ height: 104, borderRadius: '10px', bgcolor: '#2f3136' }}
              />
            ))}
          </Box>
        ) : paginatedEvents.length === 0 ? (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 6,
          }}>
            <Typography sx={{ fontSize: 14, color: '#72767d' }}>
              {t('events.empty')}
            </Typography>
          </Box>
        ) : viewMode === 'list' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {paginatedEvents.map((event) => (
              <Box
                key={event.id}
                onClick={() => navigate('/events')}
                sx={{
                  display: 'flex',
                  gap: '10px',
                  bgcolor: '#2f3136',
                  borderRadius: '10px',
                  p: '5px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  '&:hover': { bgcolor: '#34373c' },
                }}
              >
                {/* Thumbnail */}
                <Box sx={{
                  width: { xs: 120, sm: 160, md: 188 },
                  height: { xs: 60, sm: 80, md: 94 },
                  flexShrink: 0,
                  borderRadius: '15px',
                  overflow: 'hidden',
                  bgcolor: '#d9d9d9',
                }}>
                  <Box
                    component="img"
                    src={event.image_url || bannerImages[(events.indexOf(event)) % bannerImages.length]}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Box>

                {/* Event info */}
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1,
                  minWidth: 0,
                  justifyContent: 'center',
                }}>
                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: { xs: 14, md: 20 },
                    fontWeight: 400,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {event.title}
                  </Typography>

                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#dcddde',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {event.description}
                  </Typography>

                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 12,
                    fontWeight: 400,
                    color: '#72767d',
                  }}>
                    {new Date(event.event_date).toLocaleString(i18n.language, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {event.location ? `, ${event.location}` : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          /* Grid view */
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
            gap: '8px',
            flex: 1,
          }}>
            {paginatedEvents.map((event) => (
              <Box
                key={event.id}
                onClick={() => navigate('/events')}
                sx={{
                  bgcolor: '#2f3136',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  '&:hover': { bgcolor: '#34373c' },
                }}
              >
                <Box sx={{
                  width: '100%',
                  aspectRatio: '2/1',
                  overflow: 'hidden',
                }}>
                  <Box
                    component="img"
                    src={event.image_url || bannerImages[(events.indexOf(event)) % bannerImages.length]}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box sx={{ p: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {event.title}
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 11,
                    color: '#72767d',
                  }}>
                    {new Date(event.event_date).toLocaleString(i18n.language, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Pagination */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 'auto',
          pt: 1,
        }}>
          {/* Per page info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Box sx={{
              bgcolor: '#2f3136',
              borderRadius: '30px',
              px: 1.2,
              py: 0.3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Typography sx={{
                fontFamily: '"Noto Sans", sans-serif',
                fontSize: 8,
                color: '#ffffff',
              }}>
                {EVENTS_PER_PAGE}
              </Typography>
            </Box>
            <Typography sx={{
              fontFamily: '"Noto Sans", sans-serif',
              fontSize: 8,
              color: '#ffffff',
            }}>
              {t('home.perPage')}
            </Typography>
          </Box>

          {/* Page numbers */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconButton
              size="small"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              sx={{
                width: 20,
                height: 20,
                bgcolor: '#4f545c',
                borderRadius: '50%',
                color: '#b9bbbe',
                '&:hover': { bgcolor: '#5d6269' },
                '&.Mui-disabled': { bgcolor: '#36393f', color: '#4f545c' },
              }}
            >
              <ChevronLeftIcon sx={{ fontSize: 14 }} />
            </IconButton>

            {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => {
              const page = i + 1
              if (totalPages > 4 && i === 3) {
                return (
                  <Box key="ellipsis" sx={{
                    width: 20, height: 20, borderRadius: '50%',
                    bgcolor: '#4f545c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: 10, color: '#ffffff', fontFamily: '"Noto Sans", sans-serif' }}>
                      ...
                    </Typography>
                  </Box>
                )
              }
              return (
                <Box
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: currentPage === page ? '#72767d' : '#4f545c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: '#72767d' },
                  }}
                >
                  <Typography sx={{
                    fontFamily: '"Noto Sans", sans-serif',
                    fontSize: 10,
                    color: '#ffffff',
                  }}>
                    {page}
                  </Typography>
                </Box>
              )
            })}

            <IconButton
              size="small"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              sx={{
                width: 20,
                height: 20,
                bgcolor: '#4f545c',
                borderRadius: '50%',
                color: '#b9bbbe',
                '&:hover': { bgcolor: '#5d6269' },
                '&.Mui-disabled': { bgcolor: '#36393f', color: '#4f545c' },
              }}
            >
              <ChevronRightIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import { Icon, TextField, Card, Skeleton } from '../components/ui'
import { Container, Grid } from '../components/layout'
import MemberCard from '../components/MemberCard'
import MemberDialog from '../components/MemberDialog'

export default function Members() {
  const { t } = useTranslation()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMembers = useCallback(async (searchTerm: string) => {
    setLoading(true)
    try {
      const data = await edgeFunctions.getMembers({ search: searchTerm || undefined }) as { members?: any[] }
      setMembers(data.members ?? [])
    } catch (err) {
      console.error('Failed to load members:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers('')
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [loadMembers])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadMembers(value)
    }, 300)
  }

  const handleCardClick = (member: any) => {
    setSelectedMember(member)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setSelectedMember(null)
  }

  return (
    <Container maxWidth="lg" css={css({
      paddingTop: 24,
      paddingBottom: 24,
      '@media (min-width: 769px)': { paddingTop: 40, paddingBottom: 40 },
    })}>
      {/* Header */}
      <div css={css({ marginBottom: 32, textAlign: 'center' })}>
        <h1 css={css({
          fontWeight: 800,
          color: 'var(--color-on-surface)',
          marginBottom: 8,
          fontSize: 28,
          margin: '0 0 8px',
          '@media (min-width: 769px)': { fontSize: 34 },
        })}>
          {t('members.title')}
        </h1>
        <p css={css({ color: 'var(--color-on-surface-muted)', fontSize: 14, marginBottom: 24, margin: '0 0 24px' })}>
          {members.length > 0 && !loading
            ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
            : ''}
        </p>

        {/* Search */}
        <div css={css({ maxWidth: 420, width: '100%', margin: '0 auto' })}>
          <TextField
            placeholder={t('members.search')}
            value={search}
            onChange={handleSearchChange}
            fullWidth
            startAdornment={<Icon name="search" size={20} css={css({ color: 'var(--color-on-surface-muted)' })} />}
          />
        </div>
      </div>

      {/* Member Grid */}
      {loading ? (
        <Grid columns={{ xs: 2, sm: 3, md: 4 }} gap={20}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} css={css({ padding: 24, textAlign: 'center' })}>
              <Skeleton variant="circular" width={72} height={72} css={css({ margin: '0 auto 12px' })} />
              <Skeleton variant="text" width="60%" css={css({ margin: '0 auto' })} />
              <Skeleton variant="rectangular" width="40%" height={24} css={css({ margin: '8px auto 0', borderRadius: 8 })} />
            </Card>
          ))}
        </Grid>
      ) : members.length === 0 ? (
        <div css={css({ textAlign: 'center', padding: '64px 0' })}>
          <p css={css({ fontSize: 48, marginBottom: 8, margin: '0 0 8px' })}>🔍</p>
          <p css={css({ color: 'var(--color-on-surface-muted)', fontSize: 15, margin: 0 })}>{t('members.noResults')}</p>
        </div>
      ) : (
        <Grid columns={{ xs: 2, sm: 3, md: 4 }} gap={20}>
          {members.map((member) => (
            <MemberCard key={member.user_id} member={member} onClick={() => handleCardClick(member)} />
          ))}
        </Grid>
      )}

      {/* Member Dialog */}
      <MemberDialog
        member={selectedMember}
        open={dialogOpen}
        onClose={handleDialogClose}
      />
    </Container>
  )
}

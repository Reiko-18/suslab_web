import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
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
      const data = await edgeFunctions.getMembers({ search: searchTerm || undefined })
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
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800, color: 'text.primary', mb: 1,
            fontSize: { xs: 28, md: 34 },
          }}
        >
          {t('members.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {members.length > 0 && !loading
            ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
            : ''}
        </Typography>

        {/* Search */}
        <TextField
          placeholder={t('members.search')}
          value={search}
          onChange={handleSearchChange}
          sx={{
            maxWidth: 420, width: '100%',
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: 'action.hover',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: 'divider' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Member Grid */}
      {loading ? (
        <Grid container spacing={2.5}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
              <Card sx={{ borderRadius: 4, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Skeleton variant="circular" width={72} height={72} sx={{ mx: 'auto', mb: 1.5 }} />
                  <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                  <Skeleton variant="rounded" width="40%" height={24} sx={{ mx: 'auto', mt: 1, borderRadius: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : members.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 48, mb: 1 }}>🔍</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 15 }}>{t('members.noResults')}</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {members.map((member) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={member.user_id}>
              <MemberCard member={member} onClick={() => handleCardClick(member)} />
            </Grid>
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

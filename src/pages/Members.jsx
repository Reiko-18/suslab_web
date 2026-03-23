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
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const debounceRef = useRef(null)

  const loadMembers = useCallback(async (searchTerm) => {
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
  }, [loadMembers])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadMembers(value)
    }, 300)
  }

  const handleCardClick = (member) => {
    setSelectedMember(member)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setSelectedMember(null)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        {t('members.title')}
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        placeholder={t('members.search')}
        value={search}
        onChange={handleSearchChange}
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Member Grid */}
      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Skeleton variant="circular" width={64} height={64} sx={{ mx: 'auto', mb: 1 }} />
                  <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                  <Skeleton variant="text" width="40%" sx={{ mx: 'auto' }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : members.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">{t('members.noResults')}</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {members.map((member) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={member.user_id}>
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

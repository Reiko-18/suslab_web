import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'

export default function Feedback() {
  const { t } = useTranslation()
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('nav.feedback')}</Typography>
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('common.comingSoon')}</Typography>
      </Card>
    </Container>
  )
}

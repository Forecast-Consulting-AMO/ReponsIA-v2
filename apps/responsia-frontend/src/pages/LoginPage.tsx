import { Box, Button, Typography, Card, CardContent } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

export const LoginPage = () => {
  const { t } = useTranslation()
  const { loginWithRedirect } = useAuth()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            ReponsIA
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t('auth.subtitle')}
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => loginWithRedirect()}
          >
            {t('auth.login')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}

import { Card, CardContent, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../auth/AuthProvider'

// Placeholder for Phase 0/1. Real KPIs + charts arrive in Phase 2.
export function DashboardPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.dashboard')}</Typography>
      <Card>
        <CardContent>
          <Typography>
            {me ? `${me.username} — ${t(`clearance.${me.clearance}`)}` : t('common.loading')}
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}

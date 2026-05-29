import { AppBar, Box, Button, Chip, Toolbar, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { logout } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { applyLang, type Lang } from '../i18n'
import { ClassificationBanner } from './ClassificationBanner'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { me, refetch } = useAuth()

  const toggleLang = () => applyLang((i18n.language === 'ar' ? 'en' : 'ar') as Lang)
  const onLogout = async () => {
    await logout()
    refetch()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ClassificationBanner />
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t('appName')}
          </Typography>
          {me?.role && (
            <Chip
              label={i18n.language === 'ar' ? me.role.name_ar : me.role.name_en}
              color="secondary"
              size="small"
            />
          )}
          <Button onClick={toggleLang} color="inherit" size="small">
            {t('common.language')}
          </Button>
          <Button onClick={onLogout} color="inherit" size="small">
            {t('common.logout')}
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Box component="main" sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <ClassificationBanner />
    </Box>
  )
}

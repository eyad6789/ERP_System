import LanguageIcon from '@mui/icons-material/Language'
import LogoutIcon from '@mui/icons-material/Logout'
import { AppBar, Box, Button, Chip, Toolbar, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router-dom'

import { logout } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { applyLang, type Lang } from '../i18n'
import { tokens } from '../theme/tokens'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsBell } from './NotificationsBell'
import { Sidebar } from './Sidebar'

// Small gold rhombus crest.
function Crest() {
  return (
    <Box
      sx={{
        width: 26,
        height: 26,
        transform: 'rotate(45deg)',
        background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.goldDim})`,
        border: `1px solid ${tokens.goldBright}`,
        borderRadius: '6px',
        boxShadow: '0 0 16px -2px rgba(201,162,39,0.6)',
      }}
    />
  )
}

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { me, refetch } = useAuth()
  const navigate = useNavigate()

  const toggleLang = () => applyLang((i18n.language === 'ar' ? 'en' : 'ar') as Lang)
  const onLogout = async () => {
    await logout()
    refetch()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Crest />
          <Typography
            variant="h6"
            sx={{ color: tokens.text, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
          >
            {t('appName')}
          </Typography>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', px: 2 }}>
            <GlobalSearch />
          </Box>
          {me?.role && (
            <Chip
              label={i18n.language === 'ar' ? me.role.name_ar : me.role.name_en}
              size="small"
              onClick={() => navigate('/profile')}
              sx={{
                color: tokens.goldBright,
                border: `1px solid ${tokens.borderGold}`,
                bgcolor: 'rgba(201,162,39,0.08)',
                cursor: 'pointer',
              }}
            />
          )}
          <NotificationsBell />
          <Button onClick={toggleLang} color="inherit" size="small" startIcon={<LanguageIcon />}>
            {t('common.language')}
          </Button>
          <Button onClick={onLogout} color="inherit" size="small" startIcon={<LogoutIcon />}>
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
    </Box>
  )
}

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import LanguageIcon from '@mui/icons-material/Language'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import SettingsIcon from '@mui/icons-material/Settings'
import ShieldIcon from '@mui/icons-material/Shield'
import {
  AppBar,
  Box,
  Button,
  Chip,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router-dom'

import { logout } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { applyLang, type Lang } from '../i18n'
import { tokens } from '../theme/tokens'
import { AiAssistant } from './AiAssistant'
import { CommandPalette } from './CommandPalette'
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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const isSysadmin = me?.role?.code === 'sysadmin'

  const openMenu = (e: MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)
  const closeMenu = () => setMenuAnchor(null)
  const go = (path: string) => {
    closeMenu()
    navigate(path)
  }
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
              onClick={openMenu}
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
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
            <MenuItem onClick={() => go('/profile')}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              {t('profile.title')}
            </MenuItem>
            <MenuItem onClick={() => go('/security')}>
              <ListItemIcon>
                <ShieldIcon fontSize="small" />
              </ListItemIcon>
              {t('security.title')}
            </MenuItem>
            <MenuItem onClick={() => go('/settings')}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              {t('settings.title')}
            </MenuItem>
            {isSysadmin && (
              <MenuItem onClick={() => go('/admin')}>
                <ListItemIcon>
                  <AdminPanelSettingsIcon fontSize="small" />
                </ListItemIcon>
                {t('admin.title')}
              </MenuItem>
            )}
          </Menu>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Sidebar />
        <Box component="main" sx={{ flex: 1, minHeight: 0, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <CommandPalette />
      <AiAssistant />
    </Box>
  )
}

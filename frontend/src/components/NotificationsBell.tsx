import NotificationsIcon from '@mui/icons-material/Notifications'
import {
  Badge,
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { fetchAlerts, type AlertSeverity } from '../api/alerts'
import { tokens } from '../theme/tokens'

// Alert module -> in-app route, so a notification is actionable.
const MODULE_ROUTE: Record<string, string> = {
  incidents: '/incidents',
  assets: '/assets',
  finance: '/finance',
  audit: '/audit',
  operations: '/operations',
  personnel: '/personnel',
  documents: '/documents',
  gis: '/gis',
}

// Severity -> dot color, escalating warm gold toward alarm red.
const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: tokens.red,
  high: tokens.orange,
  info: tokens.cyan,
}

export function NotificationsBell() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  const { data } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30000,
  })

  const alerts = data?.alerts ?? []
  const badgeCount = alerts.reduce((sum, a) => sum + a.count, 0)

  return (
    <>
      <IconButton
        data-testid="notif-bell"
        aria-label={t('alerts.title')}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: tokens.text }}
      >
        <Badge
          badgeContent={badgeCount}
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: tokens.gold,
              color: tokens.bg,
              fontWeight: 700,
            },
          }}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: ar ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: ar ? 'right' : 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 320,
              maxWidth: 380,
              bgcolor: tokens.surface,
              border: `1px solid ${tokens.border}`,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${tokens.border}` }}>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: '"El Messiri", serif', color: tokens.text }}
          >
            {t('alerts.title')}
          </Typography>
        </Box>

        {alerts.length === 0 ? (
          <MenuItem disabled sx={{ py: 2, justifyContent: 'center', color: tokens.muted }}>
            {t('alerts.none')}
          </MenuItem>
        ) : (
          alerts.map((alert, idx) => (
            <MenuItem
              key={`${alert.module}-${idx}`}
              onClick={() => {
                setAnchorEl(null)
                const route = MODULE_ROUTE[alert.module]
                if (route) navigate(route)
              }}
              sx={{ alignItems: 'flex-start', py: 1.25, whiteSpace: 'normal' }}
            >
              <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ width: '100%' }}>
                <Box
                  sx={{
                    mt: 0.75,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: SEVERITY_COLOR[alert.severity],
                    boxShadow: `0 0 8px ${SEVERITY_COLOR[alert.severity]}66`,
                  }}
                />
                <ListItemText
                  primary={ar ? alert.message_ar : alert.message_en}
                  secondary={`${alert.module} · ${alert.count}`}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: { color: tokens.text },
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: { color: tokens.muted },
                  }}
                />
              </Stack>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  )
}

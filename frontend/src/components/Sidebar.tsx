import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExtensionIcon from '@mui/icons-material/Extension'
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'
import GavelIcon from '@mui/icons-material/Gavel'
import GroupsIcon from '@mui/icons-material/Groups'
import HubIcon from '@mui/icons-material/Hub'
import LockIcon from '@mui/icons-material/Lock'
import SearchIcon from '@mui/icons-material/Search'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import {
  Box,
  Chip,
  Collapse,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'
import { NAV_GROUPS, SYSADMIN_ONLY, isGated, type NavGroup } from '../nav/groups'
import { tokens } from '../theme/tokens'

const GROUP_ICON: Record<string, ReactNode> = {
  command: <DashboardCustomizeIcon fontSize="small" />,
  hr: <GroupsIcon fontSize="small" />,
  finance: <AccountBalanceIcon fontSize="small" />,
  operations: <HubIcon fontSize="small" />,
  records: <FolderSpecialIcon fontSize="small" />,
  service: <SupportAgentIcon fontSize="small" />,
  governance: <GavelIcon fontSize="small" />,
  platform: <ExtensionIcon fontSize="small" />,
}

const STORAGE_KEY = 'erp.sidebar.expanded'

// Groups are COLLAPSED by default — only the ~8 department headers show until the
// user opens one (or it holds the active route). Keeps the rail compact.
function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const { can, me } = useAuth()
  const location = useLocation()
  const isSysadmin = me?.role?.code === 'sysadmin'

  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded)

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage may be unavailable; collapse state simply won't persist */
      }
      return next
    })
  }

  // Which group holds the active route — used to auto-expand it.
  const activeItem = location.pathname.replace(/^\//, '').split('/')[0] ?? ''

  // Apply the text filter + sysadmin gating to each group's items.
  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return NAV_GROUPS.map((g) => {
      const items = g.items.filter((item) => {
        if (SYSADMIN_ONLY.has(item) && !isSysadmin) return false
        if (!needle) return true
        return t(`nav.${item}`).toLowerCase().includes(needle)
      })
      return { group: g, items }
    }).filter((g) => g.items.length > 0)
  }, [filter, isSysadmin, t])

  const renderItem = (item: string) => {
    const label = t(`nav.${item}`)
    const gated = isGated(item)
    const allowed = !gated || can(item)
    if (!allowed) {
      return (
        <Tooltip key={item} title={t('common.locked')} placement={ar ? 'right' : 'left'}>
          <span>
            <ListItemButton disabled aria-disabled data-testid={`nav-${item}`} sx={{ pl: 4 }}>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14 }} />
              <LockIcon fontSize="small" sx={{ color: tokens.muted, opacity: 0.7 }} />
            </ListItemButton>
          </span>
        </Tooltip>
      )
    }
    return (
      <ListItemButton
        key={item}
        component={NavLink}
        to={`/${item}`}
        data-testid={`nav-${item}`}
        sx={{
          pl: 4,
          borderInlineStart: '2px solid transparent',
          '&.active': {
            borderInlineStartColor: tokens.gold,
            bgcolor: 'rgba(201,162,39,0.08)',
            '& .MuiListItemText-primary': { color: tokens.goldBright },
          },
        }}
      >
        <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14 }} />
      </ListItemButton>
    )
  }

  const renderGroup = ({ group, items }: { group: NavGroup; items: string[] }) => {
    const filtering = filter.trim().length > 0
    const open = filtering || !!expanded[group.key] || items.includes(activeItem)
    const owned = !!me?.department && me.department === group.ownerDept
    const accessible = items.filter((i) => !isGated(i) || can(i)).length

    return (
      <Box key={group.key} sx={{ mb: 0.5 }}>
        <ListItemButton
          onClick={() => toggle(group.key)}
          data-testid={`navgroup-${group.key}`}
          sx={{
            borderRadius: 1,
            py: 0.9,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              borderRadius: 1,
              me: 1.25,
              color: group.accent,
              bgcolor: `${group.accent}1a`,
              border: `1px solid ${group.accent}33`,
            }}
          >
            {GROUP_ICON[group.icon]}
          </Box>
          <ListItemText
            primary={ar ? group.name_ar : group.name_en}
            primaryTypographyProps={{
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: tokens.text,
            }}
          />
          {owned && (
            <Tooltip title={t('navGroups.yours', 'Your department — you can edit this workspace')}>
              <VerifiedUserIcon sx={{ fontSize: 15, color: group.accent, me: 0.5 }} />
            </Tooltip>
          )}
          <Chip
            label={accessible}
            size="small"
            sx={{
              height: 18,
              minWidth: 18,
              fontSize: 10.5,
              me: 0.5,
              bgcolor: 'rgba(255,255,255,0.05)',
              color: tokens.muted,
            }}
          />
          {open ? (
            <ExpandLessIcon fontSize="small" sx={{ color: tokens.muted }} />
          ) : (
            <ExpandMoreIcon fontSize="small" sx={{ color: tokens.muted }} />
          )}
        </ListItemButton>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {items.map(renderItem)}
          </List>
        </Collapse>
      </Box>
    )
  }

  return (
    <Box
      component="nav"
      aria-label="departments"
      sx={{
        width: 248,
        flexShrink: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderInlineEnd: `1px solid ${tokens.border}`,
        bgcolor: tokens.surface,
      }}
    >
      <Box sx={{ p: 1.25, flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('navGroups.search', 'Filter pages…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          inputProps={{ 'data-testid': 'nav-filter' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: tokens.muted }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <List
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          px: 1,
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, #8c7320, #5c4d18)',
            borderRadius: 8,
          },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
        }}
      >
        {groups.map(renderGroup)}
        {groups.length === 0 && (
          <Typography sx={{ p: 2, color: tokens.muted, fontSize: 13, textAlign: 'center' }}>
            {t('navGroups.noMatch', 'No pages match your filter.')}
          </Typography>
        )}
      </List>
    </Box>
  )
}

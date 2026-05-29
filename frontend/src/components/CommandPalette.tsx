import AssignmentIcon from '@mui/icons-material/Assignment'
import DescriptionIcon from '@mui/icons-material/Description'
import GavelIcon from '@mui/icons-material/Gavel'
import InventoryIcon from '@mui/icons-material/Inventory2'
import PeopleIcon from '@mui/icons-material/People'
import PlaceIcon from '@mui/icons-material/Place'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Dialog,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  TextField,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { searchAll, type SearchKind, type SearchResult } from '../api/search'
import { tokens } from '../theme/tokens'

// kind -> module route segment (mounted under "/").
const KIND_ROUTE: Record<SearchKind, string> = {
  personnel: 'personnel',
  document: 'documents',
  site: 'gis',
  contract: 'finance',
  operation: 'operations',
  asset: 'assets',
  incident: 'incidents',
}

const KIND_ICON: Record<SearchKind, ReactNode> = {
  personnel: <PeopleIcon fontSize="small" />,
  document: <DescriptionIcon fontSize="small" />,
  site: <PlaceIcon fontSize="small" />,
  contract: <GavelIcon fontSize="small" />,
  operation: <AssignmentIcon fontSize="small" />,
  asset: <InventoryIcon fontSize="small" />,
  incident: <ReportProblemIcon fontSize="small" />,
}

// Global Ctrl/Cmd+K command palette: a centered modal that federated-searches
// every module and navigates to the matching route on Enter or click.
export function CommandPalette() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  // Toggle on Ctrl+K / Cmd+K from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Debounce the raw query by 250ms.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(id)
  }, [query])

  // Fetch on the debounced value; ignore stale responses.
  useEffect(() => {
    if (debounced.length === 0) {
      setResults([])
      return
    }
    let active = true
    searchAll(debounced)
      .then((res) => {
        if (active) setResults(res.results)
      })
      .catch(() => {
        if (active) setResults([])
      })
    return () => {
      active = false
    }
  }, [debounced])

  const close = () => {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const handleSelect = (result: SearchResult) => {
    close()
    navigate(`/${KIND_ROUTE[result.kind]}`)
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const first = results[0]
      if (first) handleSelect(first)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      data-testid="command-palette"
      slotProps={{
        paper: {
          sx: {
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.borderGold}`,
            position: 'absolute',
            top: 80,
            m: 0,
          },
        },
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${tokens.border}` }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t('command.placeholder')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: tokens.muted, fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: tokens.surface2,
              '& fieldset': { borderColor: tokens.border },
              '&:hover fieldset': { borderColor: tokens.borderGold },
              '&.Mui-focused fieldset': { borderColor: tokens.gold },
            },
          }}
        />
      </Box>

      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {t('search.noResults')}
            </Typography>
          </Box>
        ) : (
          <MenuList dense disablePadding>
            {results.map((result) => (
              <MenuItem
                key={`${result.kind}-${result.id}`}
                onClick={() => handleSelect(result)}
                sx={{ py: 1, whiteSpace: 'normal' }}
              >
                <ListItemIcon sx={{ color: tokens.gold, minWidth: 32 }}>
                  {KIND_ICON[result.kind]}
                </ListItemIcon>
                <ListItemText
                  primary={ar ? result.label_ar : result.label_en}
                  secondary={result.detail}
                  primaryTypographyProps={{ variant: 'body2', sx: { color: tokens.text } }}
                  secondaryTypographyProps={{ variant: 'caption', sx: { color: tokens.muted } }}
                />
              </MenuItem>
            ))}
          </MenuList>
        )}
      </Box>
    </Dialog>
  )
}

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
  ClickAwayListener,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  TextField,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
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

export function GlobalSearch() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const navigate = useNavigate()
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)

  // Debounce the raw query by 300ms.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(id)
  }, [query])

  // Fetch on the debounced value; ignore stale responses.
  useEffect(() => {
    if (debounced.length === 0) {
      setResults([])
      setOpen(false)
      return
    }
    let active = true
    searchAll(debounced)
      .then((res) => {
        if (!active) return
        setResults(res.results)
        setOpen(true)
      })
      .catch(() => {
        if (!active) return
        setResults([])
        setOpen(true)
      })
    return () => {
      active = false
    }
  }, [debounced])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    navigate(`/${KIND_ROUTE[result.kind]}`)
  }

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} data-testid="global-search" sx={{ width: 280 }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          placeholder={t('search.placeholder')}
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

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorRef.current?.clientWidth }}
        >
          <Paper
            sx={{
              mt: 0.5,
              bgcolor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
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
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  )
}

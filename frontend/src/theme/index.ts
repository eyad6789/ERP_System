import { createTheme, type Theme } from '@mui/material/styles'

import { tokens } from './tokens'

const DISPLAY = '"El Messiri", "Tajawal", "Segoe UI", serif'
const BODY = '"Tajawal", "Segoe UI", "Tahoma", system-ui, sans-serif'

export function buildTheme(direction: 'rtl' | 'ltr'): Theme {
  return createTheme({
    direction,
    palette: {
      mode: 'dark',
      background: { default: tokens.bg, paper: tokens.surface },
      primary: { main: tokens.gold, contrastText: '#16140d' },
      secondary: { main: tokens.cyan },
      success: { main: tokens.green },
      error: { main: tokens.red },
      warning: { main: tokens.orange },
      text: { primary: tokens.text, secondary: tokens.muted },
      divider: tokens.border,
    },
    typography: {
      fontFamily: BODY,
      h1: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: '0.01em' },
      h2: { fontFamily: DISPLAY, fontWeight: 700 },
      h3: { fontFamily: DISPLAY, fontWeight: 600 },
      h4: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '0.01em' },
      h5: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '0.02em' },
      h6: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: '0.02em' },
      subtitle1: { fontWeight: 600, letterSpacing: '0.02em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.02em' },
      overline: { letterSpacing: '0.22em', fontWeight: 600 },
    },
    shape: { borderRadius: 14 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: `linear-gradient(158deg, ${tokens.surface2}, ${tokens.surface})`,
            border: `1px solid ${tokens.border}`,
            borderRadius: 16,
            boxShadow: '0 18px 40px -28px rgba(0,0,0,0.85)',
            transition: 'border-color .2s ease, transform .2s ease, box-shadow .2s ease',
            '&:hover': {
              borderColor: tokens.borderGold,
              transform: 'translateY(-2px)',
              boxShadow: '0 26px 50px -28px rgba(0,0,0,0.9)',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: `linear-gradient(180deg, ${tokens.surface2}, ${tokens.bg})`,
            borderBottom: `1px solid ${tokens.borderGold}`,
            boxShadow: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, letterSpacing: '0.02em', borderRadius: 8 },
          outlined: { borderWidth: 1 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: tokens.border },
          head: {
            color: tokens.muted,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            backgroundColor: 'transparent',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          hover: { '&:hover': { backgroundColor: 'rgba(201,162,39,0.06)' } },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            margin: '2px 8px',
            '&.active, &.Mui-selected': {
              backgroundColor: 'rgba(201,162,39,0.12)',
              color: tokens.goldBright,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary: {
            backgroundImage: `linear-gradient(180deg, ${tokens.goldBright}, ${tokens.gold})`,
            color: '#16140d',
            '&:hover': { backgroundImage: `linear-gradient(180deg, ${tokens.gold}, ${tokens.goldDim})` },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: `linear-gradient(158deg, ${tokens.surface2}, ${tokens.surface})`,
            border: `1px solid ${tokens.borderGold}`,
          },
        },
      },
    },
  })
}

import { createTheme, type Theme } from '@mui/material/styles'

import { tokens } from './tokens'

export function buildTheme(direction: 'rtl' | 'ltr'): Theme {
  return createTheme({
    direction,
    palette: {
      mode: 'dark',
      background: { default: tokens.bg, paper: tokens.surface },
      primary: { main: tokens.cyan },
      secondary: { main: tokens.gold },
      success: { main: tokens.green },
      error: { main: tokens.red },
      warning: { main: tokens.orange },
      text: { primary: tokens.text, secondary: tokens.muted },
      divider: tokens.border,
    },
    typography: {
      fontFamily: '"Segoe UI", "Tahoma", system-ui, -apple-system, sans-serif',
    },
    shape: { borderRadius: 12 },
  })
}

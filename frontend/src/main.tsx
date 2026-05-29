import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'

import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import i18n, { applyLang } from './i18n'
import { buildTheme } from './theme'

applyLang('ar')

const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] })
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={buildTheme('rtl')}>
        <CssBaseline />
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </I18nextProvider>
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
)

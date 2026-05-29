import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material'
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
        <GlobalStyles
          styles={{
            body: {
              backgroundColor: '#121212',
              backgroundImage:
                'radial-gradient(1100px 560px at 85% -8%, rgba(201,162,39,0.10), transparent 60%),' +
                'radial-gradient(820px 620px at -5% 110%, rgba(201,162,39,0.05), transparent 60%),' +
                'linear-gradient(180deg, #141312, #121212)',
              backgroundAttachment: 'fixed',
            },
            // faint topographic grid for institutional depth
            '#root::before': {
              content: '""',
              position: 'fixed',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0.5,
              backgroundImage:
                'linear-gradient(rgba(201,162,39,0.025) 1px, transparent 1px),' +
                'linear-gradient(90deg, rgba(201,162,39,0.025) 1px, transparent 1px)',
              backgroundSize: '52px 52px',
            },
            '*::-webkit-scrollbar': { width: 10, height: 10 },
            '*::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(180deg, #8c7320, #5c4d18)',
              borderRadius: 8,
              border: '2px solid #121212',
            },
            '*::-webkit-scrollbar-track': { background: '#161514' },
          }}
        />
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

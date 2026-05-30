import ExtensionIcon from '@mui/icons-material/Extension'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.plugins'

type Category = 'security' | 'analytics' | 'comms' | 'storage' | 'gis' | 'ai'

interface Plugin {
  id: string
  name: string
  category: Category
  description: string
  version: string
}

// Per-category accent (from the shared tokens) used for the card chip + rail.
const CATEGORY_COLOR: Record<Category, string> = {
  security: tokens.red,
  analytics: tokens.cyan,
  comms: tokens.gold,
  storage: tokens.green,
  gis: tokens.orange,
  ai: tokens.goldBright,
}

// Static plugin catalogue — frontend-only, no network. Install state lives in
// localStorage under STORAGE_KEY as an array of plugin ids.
const PLUGINS: Plugin[] = [
  {
    id: 'siem-connector',
    name: 'SIEM Connector',
    category: 'security',
    description: 'Stream audit events to your SIEM for correlation and alerting.',
    version: '2.4.1',
  },
  {
    id: 'ldap-ad-sync',
    name: 'LDAP / AD Sync',
    category: 'security',
    description: 'Synchronise users and groups from Active Directory or LDAP.',
    version: '1.9.0',
  },
  {
    id: 'mfa-push',
    name: 'MFA Push',
    category: 'security',
    description: 'Approve sign-ins with push notifications instead of codes.',
    version: '3.1.2',
  },
  {
    id: 'power-bi',
    name: 'Power BI',
    category: 'analytics',
    description: 'Publish curated datasets to Microsoft Power BI dashboards.',
    version: '4.0.0',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    category: 'analytics',
    description: 'Expose operational metrics to Grafana panels and alerts.',
    version: '2.2.5',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'comms',
    description: 'Route notifications and approvals into Slack channels.',
    version: '5.3.0',
  },
  {
    id: 'ms-teams',
    name: 'MS Teams',
    category: 'comms',
    description: 'Post alerts and adaptive cards to Microsoft Teams.',
    version: '5.1.4',
  },
  {
    id: 'twilio-sms',
    name: 'Twilio SMS',
    category: 'comms',
    description: 'Send SMS alerts and one-time codes through Twilio.',
    version: '1.6.0',
  },
  {
    id: 's3-backup',
    name: 'S3 Backup',
    category: 'storage',
    description: 'Encrypt and ship scheduled backups to S3-compatible storage.',
    version: '3.0.1',
  },
  {
    id: 'on-prem-vault',
    name: 'On-Prem Vault',
    category: 'storage',
    description: 'Keep secrets and keys inside a self-hosted vault.',
    version: '2.7.3',
  },
  {
    id: 'maptiler',
    name: 'MapTiler',
    category: 'gis',
    description: 'Serve vector basemaps and tiles for the GIS module.',
    version: '1.4.2',
  },
  {
    id: 'satellite-feed',
    name: 'Satellite Feed',
    category: 'gis',
    description: 'Overlay near-real-time satellite imagery on operations maps.',
    version: '0.9.6',
  },
  {
    id: 'on-prem-llm',
    name: 'On-Prem LLM',
    category: 'ai',
    description: 'Run a self-hosted language model for summaries and search.',
    version: '0.5.0',
  },
]

const CATEGORIES: Category[] = ['security', 'analytics', 'comms', 'storage', 'gis', 'ai']

function loadInstalled(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function MarketplacePage() {
  const { t } = useTranslation()
  const [installed, setInstalled] = useState<string[]>(() => loadInstalled())
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(installed))
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, [installed])

  const toggle = (id: string) => {
    setInstalled((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PLUGINS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    })
  }, [category, query])

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.marketplace', 'Plugin Marketplace')}</Typography>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('marketplace.installedCount', 'Installed plugins')}
          value={installed.length}
          accent={tokens.gold}
          icon={<ExtensionIcon />}
        />
        <StatCard
          label={t('marketplace.available', 'Available plugins')}
          value={PLUGINS.length}
          accent={tokens.cyan}
          icon={<ExtensionIcon />}
        />
      </Stack>

      <SectionCard title={t('marketplace.catalogue', 'Catalogue')}>
        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
          alignItems="center"
        >
          <TextField
            select
            size="small"
            label={t('marketplace.category', 'Category')}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | 'all')}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">{t('marketplace.allCategories', 'All categories')}</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`marketplace.cat.${c}`, c)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label={t('marketplace.search', 'Search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: tokens.muted }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {visible.length === 0 ? (
          <Typography sx={{ color: tokens.muted, py: 4, textAlign: 'center' }}>
            {t('marketplace.empty', 'No plugins match your filters.')}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {visible.map((p) => {
              const accent = CATEGORY_COLOR[p.category]
              const isInstalled = installed.includes(p.id)
              return (
                <Box
                  key={p.id}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: tokens.surface2,
                    border: `1px solid ${tokens.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      insetInlineStart: 0,
                      width: 3,
                      height: '100%',
                      background: accent,
                    }}
                  />
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography sx={{ color: tokens.text, fontWeight: 700 }}>{p.name}</Typography>
                    <Chip
                      label={t(`marketplace.cat.${p.category}`, p.category)}
                      size="small"
                      variant="outlined"
                      sx={{ color: accent, borderColor: `${accent}66`, fontWeight: 600 }}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ color: tokens.muted, flex: 1 }}>
                    {t(`marketplace.desc.${p.id}`, p.description)}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      {t('marketplace.version', 'Version')} {p.version}
                    </Typography>
                    <Button
                      size="small"
                      variant={isInstalled ? 'outlined' : 'contained'}
                      color={isInstalled ? 'inherit' : 'primary'}
                      onClick={() => toggle(p.id)}
                      data-testid={`plugin-toggle-${p.id}`}
                    >
                      {isInstalled
                        ? t('marketplace.installed', 'Installed')
                        : t('marketplace.install', 'Install')}
                    </Button>
                  </Stack>
                </Box>
              )
            })}
          </Box>
        )}
      </SectionCard>
    </Stack>
  )
}

import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DnsIcon from '@mui/icons-material/Dns'
import KeyIcon from '@mui/icons-material/Key'
import LanIcon from '@mui/icons-material/Lan'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import SecurityIcon from '@mui/icons-material/Security'
import StorageIcon from '@mui/icons-material/Storage'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import WebhookIcon from '@mui/icons-material/Webhook'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

// ---- Persisted shapes -------------------------------------------------------

interface ApiKey {
  id: string
  label: string
  key: string
  createdAt: string
}

interface Webhook {
  id: string
  url: string
  event: string
  createdAt: string
}

interface ServiceMeta {
  id: string
  labelKey: string
  fallback: string
  icon: ReactNode
}

const KEYS_STORE = 'erp.apikeys'
const WEBHOOKS_STORE = 'erp.webhooks'
const SERVICES_STORE = 'erp.integrations'

const WEBHOOK_EVENTS = [
  'asset.created',
  'asset.updated',
  'incident.raised',
  'user.login',
  'document.signed',
] as const

const SERVICES: ReadonlyArray<ServiceMeta> = [
  { id: 'smtp', labelKey: 'integrations.svc.smtp', fallback: 'SMTP Mail', icon: <MailOutlineIcon /> },
  { id: 'siem', labelKey: 'integrations.svc.siem', fallback: 'SIEM', icon: <SecurityIcon /> },
  { id: 'ldap', labelKey: 'integrations.svc.ldap', fallback: 'LDAP Directory', icon: <LanIcon /> },
  { id: 's3', labelKey: 'integrations.svc.s3', fallback: 'S3 Storage', icon: <StorageIcon /> },
  { id: 'dns', labelKey: 'integrations.svc.dns', fallback: 'DNS', icon: <DnsIcon /> },
] as const

// ---- localStorage helpers ---------------------------------------------------

function loadJSON<T>(storeKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storeKey)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function usePersistentState<T>(storeKey: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => loadJSON<T>(storeKey, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(value))
    } catch {
      /* storage unavailable — keep in-memory state */
    }
  }, [storeKey, value])
  return [value, setValue]
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- Component --------------------------------------------------------------

export function IntegrationsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar' : 'en'

  const [apiKeys, setApiKeys] = usePersistentState<ApiKey[]>(KEYS_STORE, [])
  const [webhooks, setWebhooks] = usePersistentState<Webhook[]>(WEBHOOKS_STORE, [])
  const [services, setServices] = usePersistentState<Record<string, boolean>>(SERVICES_STORE, {})

  const [keyLabel, setKeyLabel] = useState('')
  const [hookUrl, setHookUrl] = useState('')
  const [hookEvent, setHookEvent] = useState<string>(WEBHOOK_EVENTS[0])

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  )
  const formatTs = useCallback((iso: string) => fmt.format(new Date(iso)), [fmt])

  const generateKey = () => {
    const now = new Date()
    const label = keyLabel.trim() || t('integrations.untitledKey', 'Untitled key')
    const next: ApiKey = {
      id: randomHex(8),
      label,
      key: randomHex(24),
      createdAt: now.toISOString(),
    }
    setApiKeys([next, ...apiKeys])
    setKeyLabel('')
  }

  const revokeKey = (id: string) => setApiKeys(apiKeys.filter((k) => k.id !== id))

  const copyKey = (key: string) => {
    void navigator.clipboard?.writeText(key)
  }

  const addWebhook = () => {
    const url = hookUrl.trim()
    if (url === '') return
    const next: Webhook = {
      id: randomHex(8),
      url,
      event: hookEvent,
      createdAt: new Date().toISOString(),
    }
    setWebhooks([next, ...webhooks])
    setHookUrl('')
  }

  const deleteWebhook = (id: string) => setWebhooks(webhooks.filter((w) => w.id !== id))

  const toggleService = (id: string, on: boolean) =>
    setServices({ ...services, [id]: on })

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.integrations')}</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
        {/* (1) API Keys ---------------------------------------------------- */}
        <SectionCard
          title={t('integrations.apiKeys', 'API Keys')}
          sx={{ minWidth: 360 }}
        >
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              label={t('integrations.keyLabel', 'Key label')}
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              inputProps={{ 'data-testid': 'apikey-label' }}
            />
            <Button
              variant="contained"
              startIcon={<VpnKeyIcon />}
              onClick={generateKey}
              data-testid="apikey-generate"
              sx={{ flexShrink: 0 }}
            >
              {t('integrations.generate', 'Generate')}
            </Button>
          </Stack>

          {apiKeys.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.muted, py: 2 }}>
              {t('integrations.noKeys', 'No API keys yet.')}
            </Typography>
          ) : (
            <Stack spacing={1.25} data-testid="apikey-list">
              {apiKeys.map((k) => (
                <Box
                  key={k.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 1,
                    bgcolor: tokens.surface2,
                  }}
                >
                  <KeyIcon sx={{ color: tokens.gold, fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ color: tokens.text, fontWeight: 600 }}>
                      {k.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: tokens.muted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {k.key}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.muted }}>
                      {t('integrations.created', 'Created')}: {formatTs(k.createdAt)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={t('integrations.copy', 'Copy')}
                    onClick={() => copyKey(k.key)}
                    data-testid="apikey-copy"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('integrations.revoke', 'Revoke')}
                    onClick={() => revokeKey(k.id)}
                    data-testid="apikey-revoke"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>

        {/* (2) Webhooks ---------------------------------------------------- */}
        <SectionCard title={t('integrations.webhooks', 'Webhooks')} sx={{ minWidth: 360 }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              label={t('integrations.endpointUrl', 'Endpoint URL')}
              placeholder="https://example.com/hook"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
              inputProps={{ 'data-testid': 'webhook-url' }}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                select
                size="small"
                fullWidth
                label={t('integrations.event', 'Event')}
                value={hookEvent}
                onChange={(e) => setHookEvent(e.target.value)}
                inputProps={{ 'data-testid': 'webhook-event' }}
              >
                {WEBHOOK_EVENTS.map((ev) => (
                  <MenuItem key={ev} value={ev}>
                    {t(`integrations.events.${ev}`, ev)}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addWebhook}
                disabled={hookUrl.trim() === ''}
                data-testid="webhook-add"
                sx={{ flexShrink: 0 }}
              >
                {t('common.add', 'Add')}
              </Button>
            </Stack>
          </Stack>

          {webhooks.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.muted, py: 2 }}>
              {t('integrations.noWebhooks', 'No webhooks configured.')}
            </Typography>
          ) : (
            <Stack spacing={1.25} data-testid="webhook-list">
              {webhooks.map((w) => (
                <Box
                  key={w.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 1,
                    bgcolor: tokens.surface2,
                  }}
                >
                  <WebhookIcon sx={{ color: tokens.gold, fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: tokens.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w.url}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.muted }}>
                      {formatTs(w.createdAt)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`integrations.events.${w.event}`, w.event)}
                    sx={{ color: tokens.gold, borderColor: tokens.borderGold }}
                  />
                  <IconButton
                    size="small"
                    aria-label={t('common.delete', 'Delete')}
                    onClick={() => deleteWebhook(w.id)}
                    data-testid="webhook-delete"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>

      {/* (3) Connected services ------------------------------------------- */}
      <SectionCard title={t('integrations.connected', 'Connected services')}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 2,
          }}
        >
          {SERVICES.map((svc) => {
            const on = services[svc.id] ?? false
            return (
              <Box
                key={svc.id}
                data-testid="service-card"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  border: `1px solid ${on ? tokens.borderGold : tokens.border}`,
                  borderRadius: 1,
                  bgcolor: tokens.surface2,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: on ? tokens.gold : tokens.muted,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? tokens.gold : tokens.border}`,
                    flexShrink: 0,
                    '& svg': { fontSize: 20 },
                  }}
                >
                  {svc.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: tokens.text, fontWeight: 600 }}>
                    {t(svc.labelKey, svc.fallback)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: tokens.muted }}>
                    {on
                      ? t('integrations.enabled', 'Enabled')
                      : t('integrations.disabled', 'Disabled')}
                  </Typography>
                </Box>
                <Switch
                  checked={on}
                  onChange={(e) => toggleService(svc.id, e.target.checked)}
                  inputProps={{ 'aria-label': t(svc.labelKey, svc.fallback) }}
                  data-testid={`service-toggle-${svc.id}`}
                />
              </Box>
            )
          })}
        </Box>
      </SectionCard>
    </Stack>
  )
}

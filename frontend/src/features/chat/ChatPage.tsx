import SendIcon from '@mui/icons-material/Send'
import TagIcon from '@mui/icons-material/Tag'
import {
  Avatar,
  Badge,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.chat'
const ME = 'me'

interface ChatMessage {
  id: string
  author: string
  text: string
  time: number
}

interface ChatChannel {
  id: string
  name: string
  messages: ChatMessage[]
  unread: number
}

function randomId(): string {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return `${buf[0]!.toString(36)}${buf[1]!.toString(36)}`
}

function seedChannels(): ChatChannel[] {
  return ['operations', 'intel', 'logistics', 'hr'].map((name) => ({
    id: name,
    name,
    messages: [],
    unread: 0,
  }))
}

function loadChannels(): ChatChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedChannels()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return seedChannels()
    return parsed as ChatChannel[]
  } catch {
    return seedChannels()
  }
}

export function ChatPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'

  const [channels, setChannels] = useState<ChatChannel[]>(loadChannels)
  const [activeId, setActiveId] = useState<string>(() => channels[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels))
  }, [channels])

  const active = useMemo(
    () => channels.find((c) => c.id === activeId) ?? channels[0],
    [channels, activeId],
  )

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active?.messages.length, activeId])

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(ar ? 'ar' : 'en', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [ar],
  )

  const selectChannel = (id: string) => {
    setActiveId(id)
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }

  const send = () => {
    const text = draft.trim()
    if (!text || !active) return
    const msg: ChatMessage = { id: randomId(), author: ME, text, time: Date.now() }
    setChannels((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, messages: [...c.messages, msg], unread: 0 } : c,
      ),
    )
    setDraft('')
  }

  const channelLabel = (name: string) => t(`chat.channel.${name}`, name)

  const lastPreview = (c: ChatChannel): string => {
    const last = c.messages[c.messages.length - 1]
    return last ? last.text : t('chat.noMessages', 'No messages yet')
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.chat', 'Messaging')}</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <SectionCard title={t('chat.channels', 'Channels')} sx={{ minWidth: 0 }}>
          <List disablePadding data-testid="chat-channels">
            {channels.map((c) => {
              const selected = c.id === active?.id
              return (
                <ListItemButton
                  key={c.id}
                  selected={selected}
                  onClick={() => selectChannel(c.id)}
                  data-testid="chat-channel"
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    borderInlineStart: `2px solid ${selected ? tokens.gold : 'transparent'}`,
                    '&.Mui-selected': { bgcolor: tokens.surface3 },
                  }}
                >
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <TagIcon sx={{ fontSize: 16, color: tokens.gold }} />
                      <Typography
                        sx={{
                          color: tokens.text,
                          fontWeight: selected ? 700 : 500,
                          flex: 1,
                          minWidth: 0,
                        }}
                        noWrap
                      >
                        {channelLabel(c.name)}
                      </Typography>
                      {c.unread > 0 && (
                        <Badge
                          badgeContent={c.unread}
                          sx={{ '& .MuiBadge-badge': { bgcolor: tokens.gold, color: tokens.bg } }}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{ color: tokens.muted, display: 'block', mt: 0.25, pl: 3 }}
                      noWrap
                    >
                      {lastPreview(c)}
                    </Typography>
                  </Box>
                </ListItemButton>
              )
            })}
          </List>
        </SectionCard>

        <SectionCard
          title={active ? `# ${channelLabel(active.name)}` : t('chat.channels', 'Channels')}
          sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Box
            ref={threadRef}
            data-testid="chat-thread"
            sx={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 360,
              maxHeight: '52vh',
              px: 0.5,
              py: 1,
            }}
          >
            {active && active.messages.length === 0 && (
              <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  {t('chat.empty', 'No messages yet. Start the conversation.')}
                </Typography>
              </Box>
            )}
            <Stack spacing={1.5}>
              {active?.messages.map((m) => {
                const mine = m.author === ME
                return (
                  <Stack
                    key={m.id}
                    direction="row"
                    spacing={1}
                    data-testid="chat-message"
                    sx={{
                      justifyContent: mine ? 'flex-end' : 'flex-start',
                      flexDirection: mine ? 'row-reverse' : 'row',
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 30,
                        height: 30,
                        fontSize: 13,
                        bgcolor: mine ? tokens.gold : tokens.surface3,
                        color: mine ? tokens.bg : tokens.text,
                      }}
                    >
                      {(mine ? t('chat.me', 'me') : m.author).charAt(0).toUpperCase()}
                    </Avatar>
                    <Box
                      sx={{
                        maxWidth: '72%',
                        bgcolor: mine ? `${tokens.gold}22` : tokens.surface2,
                        border: `1px solid ${mine ? tokens.borderGold : tokens.border}`,
                        borderRadius: 2,
                        px: 1.5,
                        py: 0.75,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="baseline"
                        sx={{ mb: 0.25 }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: tokens.gold, fontWeight: 700 }}
                        >
                          {mine ? t('chat.me', 'me') : m.author}
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.muted }}>
                          {timeFmt.format(new Date(m.time))}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ color: tokens.text, wordBreak: 'break-word' }}
                      >
                        {m.text}
                      </Typography>
                    </Box>
                  </Stack>
                )
              })}
            </Stack>
          </Box>

          <Divider sx={{ borderColor: tokens.border, my: 1.5 }} />

          <Stack
            component="form"
            direction="row"
            spacing={1}
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder={t('chat.composerPlaceholder', 'Type a message')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputProps={{ 'data-testid': 'chat-input' }}
            />
            <IconButton
              type="submit"
              aria-label={t('chat.send', 'Send')}
              data-testid="chat-send"
              disabled={draft.trim() === ''}
              sx={{
                color: tokens.bg,
                bgcolor: tokens.gold,
                '&:hover': { bgcolor: tokens.goldBright },
                '&.Mui-disabled': { bgcolor: tokens.surface3, color: tokens.muted },
              }}
            >
              <SendIcon fontSize="small" sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />
            </IconButton>
          </Stack>
        </SectionCard>
      </Box>
    </Stack>
  )
}

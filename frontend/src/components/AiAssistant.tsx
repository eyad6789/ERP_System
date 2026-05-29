import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import SummarizeIcon from '@mui/icons-material/Summarize'
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  Fab,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { askAssistant, fetchBriefing } from '../api/ai'
import { tokens } from '../theme/tokens'

interface Msg {
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTIONS = [
  { en: 'How many open incidents and personnel?', ar: 'كم عدد الحوادث المفتوحة والأفراد؟' },
  { en: 'Show me the active alerts', ar: 'أظهر التنبيهات النشطة' },
  { en: 'What is the budget status?', ar: 'ما حالة الميزانية؟' },
]

export function AiAssistant() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])

  const push = (m: Msg) => setMessages((prev) => [...prev, m])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    push({ role: 'user', text: q })
    setInput('')
    setBusy(true)
    try {
      const reply = await askAssistant(q, i18n.language)
      push({ role: 'assistant', text: reply.answer })
    } catch {
      push({ role: 'assistant', text: t('ai.error', 'Unable to answer right now.') })
    } finally {
      setBusy(false)
    }
  }

  const briefing = async () => {
    if (busy) return
    setBusy(true)
    try {
      const b = await fetchBriefing(i18n.language)
      push({ role: 'assistant', text: `${b.summary}\n→ ${b.recommendation}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Fab
        data-testid="ai-fab"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          insetInlineEnd: 24,
          background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.gold})`,
          color: '#16140d',
          '&:hover': { background: `linear-gradient(135deg, ${tokens.gold}, ${tokens.goldDim})` },
        }}
        aria-label="AI assistant"
      >
        <AutoAwesomeIcon />
      </Fab>

      <Drawer anchor={ar ? 'left' : 'right'} open={open} onClose={() => setOpen(false)}>
        <Box data-testid="ai-panel" sx={{ width: 380, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 2, borderBottom: `1px solid ${tokens.border}` }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon sx={{ color: tokens.gold }} />
              <Typography variant="subtitle1">{t('ai.title', 'AI Assistant')}</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {messages.length === 0 && (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('ai.hint', 'Ask about your data — answers respect your clearance.')}
                </Typography>
                {SUGGESTIONS.map((s, i) => (
                  <Chip
                    key={i}
                    label={ar ? s.ar : s.en}
                    onClick={() => send(ar ? s.ar : s.en)}
                    variant="outlined"
                    sx={{ justifyContent: 'flex-start', borderColor: tokens.borderGold }}
                  />
                ))}
              </Stack>
            )}
            <Stack spacing={1.5}>
              {messages.map((m, i) => (
                <Box
                  key={i}
                  sx={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    p: 1.25,
                    borderRadius: 2,
                    whiteSpace: 'pre-wrap',
                    fontSize: 14,
                    bgcolor: m.role === 'user' ? 'rgba(201,162,39,0.14)' : tokens.surface2,
                    border: `1px solid ${m.role === 'user' ? tokens.borderGold : tokens.border}`,
                  }}
                >
                  {m.text}
                </Box>
              ))}
              {busy && <CircularProgress size={20} sx={{ color: tokens.gold }} />}
            </Stack>
          </Box>

          <Box sx={{ p: 2, borderTop: `1px solid ${tokens.border}` }}>
            <Chip
              icon={<SummarizeIcon />}
              label={t('ai.briefing', 'Daily briefing')}
              onClick={briefing}
              size="small"
              sx={{ mb: 1.5, borderColor: tokens.borderGold }}
              variant="outlined"
            />
            <TextField
              fullWidth
              size="small"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send(input)
              }}
              placeholder={t('ai.placeholder', 'Ask the assistant…')}
              data-testid="ai-input"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => void send(input)} aria-label="send" size="small">
                        <SendIcon fontSize="small" sx={{ color: tokens.gold }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Box>
      </Drawer>
    </>
  )
}

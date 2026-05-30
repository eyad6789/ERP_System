import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchList, type EventListItem, type EventType } from '../../api/events'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

// MUI Chip color per event type (per spec).
const TYPE_COLOR: Record<EventType, 'primary' | 'error' | 'success' | 'warning'> = {
  meeting: 'primary',
  deadline: 'error',
  holiday: 'success',
  operation: 'warning',
}

// View anchor: which year/month grid is on screen.
interface MonthView {
  year: number
  month: number // 0-11
}

// A grid cell: a calendar day (or a leading/trailing blank from the next/prev month).
interface DayCell {
  key: string
  day: number | null // null = padding cell outside the current month
  iso: string | null // YYYY-MM-DD for the day, matched against event start_at
}

// Local-date key (avoids UTC shifting that toISOString would introduce).
function dayKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// Build a 7-col x up-to-6-row grid (Sun-first) for the given month.
function buildGrid(year: number, month: number): DayCell[] {
  const firstWeekday = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: DayCell[] = []
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `pad-lead-${i}`, day: null, iso: null })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ key: `day-${d}`, day: d, iso: dayKey(year, month, d) })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-trail-${cells.length}`, day: null, iso: null })
  }
  return cells
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'

  // Construct the Date INSIDE the component (lazy initializer), never at module top.
  const [view, setView] = useState<MonthView>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['events', 'calendar'],
    queryFn: () => fetchList(),
  })
  const events: EventListItem[] = data ?? []

  const grid = useMemo(() => buildGrid(view.year, view.month), [view])

  // Group events by their start day (local YYYY-MM-DD prefix of start_at).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventListItem[]>()
    for (const ev of events) {
      const iso = ev.start_at.slice(0, 10)
      const list = map.get(iso)
      if (list) list.push(ev)
      else map.set(iso, [ev])
    }
    return map
  }, [events])

  const monthLabel = useMemo(
    () =>
      new Date(view.year, view.month, 1).toLocaleDateString(ar ? 'ar' : 'en', {
        month: 'long',
        year: 'numeric',
      }),
    [view, ar],
  )

  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const title = (ev: EventListItem) => (ar ? ev.title_ar : ev.title_en)
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })

  const selectedEvents = selectedIso ? (eventsByDay.get(selectedIso) ?? []) : []

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.calendar')}</Typography>

      <SectionCard
        title={monthLabel}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              aria-label={t('calendar.prev', 'Previous month')}
              data-testid="cal-prev"
              onClick={() => step(-1)}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              aria-label={t('calendar.next', 'Next month')}
              data-testid="cal-next"
              onClick={() => step(1)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {WEEKDAY_KEYS.map((wk) => (
            <Typography
              key={wk}
              variant="overline"
              sx={{ color: tokens.muted, textAlign: 'center' }}
            >
              {t(`calendar.${wk}`, wk.charAt(0).toUpperCase() + wk.slice(1))}
            </Typography>
          ))}

          {grid.map((cell) => {
            if (cell.day === null || cell.iso === null) {
              return <Box key={cell.key} sx={{ minHeight: 96 }} />
            }
            const iso = cell.iso
            const dayEvents = eventsByDay.get(iso) ?? []
            return (
              <Box
                key={cell.key}
                data-testid="cal-day"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIso(iso)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedIso(iso)
                }}
                sx={{
                  minHeight: 96,
                  p: 0.75,
                  borderRadius: 1,
                  border: `1px solid ${tokens.border}`,
                  bgcolor: tokens.surface2,
                  cursor: 'pointer',
                  transition: 'border-color 120ms',
                  '&:hover': { borderColor: tokens.borderGold },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: tokens.muted, fontWeight: 600, display: 'block', mb: 0.5 }}
                >
                  {cell.day}
                </Typography>
                <Stack spacing={0.5}>
                  {dayEvents.map((ev) => (
                    <Chip
                      key={ev.id}
                      size="small"
                      color={TYPE_COLOR[ev.event_type]}
                      label={title(ev)}
                      data-testid="cal-event"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedIso(iso)
                      }}
                      sx={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        '& .MuiChip-label': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )
          })}
        </Box>
      </SectionCard>

      <Dialog
        open={selectedIso !== null}
        onClose={() => setSelectedIso(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{selectedIso ?? ''}</DialogTitle>
        <DialogContent>
          {selectedEvents.length === 0 ? (
            <Typography sx={{ color: tokens.muted, py: 2 }}>
              {t('calendar.noEvents', 'No events')}
            </Typography>
          ) : (
            <Stack spacing={2} sx={{ py: 1 }}>
              {selectedEvents.map((ev) => (
                <Box
                  key={ev.id}
                  data-testid="cal-detail-event"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${tokens.border}`,
                    bgcolor: tokens.surface2,
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography sx={{ color: tokens.text, fontWeight: 600 }}>
                      {title(ev)}
                    </Typography>
                    <Chip
                      size="small"
                      color={TYPE_COLOR[ev.event_type]}
                      label={t(`calendar.${ev.event_type}`, ev.event_type)}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ mt: 1, color: tokens.muted }}
                  >
                    <Typography variant="body2">
                      {timeOf(ev.start_at)} – {timeOf(ev.end_at)}
                    </Typography>
                    {ev.location && <Typography variant="body2">· {ev.location}</Typography>}
                    <ClassificationBadge level={ev.classification} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  )
}

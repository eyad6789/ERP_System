import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchStream, type StreamResult, type StreamRow } from '../../api/activity-stream'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const PAGE_SIZE = 20
const RESULT_OPTIONS: StreamResult[] = ['GRANTED', 'DENIED']

// One node on the vertical timeline: a coloured dot + connector, the event time,
// and a single line of actor / action / target with a GRANTED|DENIED chip.
function TimelineRow({ row, last }: { row: StreamRow; last: boolean }) {
  const { t } = useTranslation()
  const granted = row.result === 'GRANTED'
  const dot = granted ? tokens.green : tokens.red
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }} data-testid="stream-row">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 18,
          flexShrink: 0,
        }}
      >
        <FiberManualRecordIcon sx={{ fontSize: 12, color: dot, mt: 0.6 }} />
        {!last && <Box sx={{ flex: 1, width: 2, bgcolor: tokens.border, mt: 0.5 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2.5, minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{ color: tokens.muted, fontFamily: 'monospace', display: 'block' }}
        >
          {row.ts.slice(0, 19).replace('T', ' ')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ color: tokens.text, fontWeight: 600 }}>
            {row.actor_label}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, fontFamily: 'monospace' }}>
            {row.action}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {row.target_type}:{row.target_id}
          </Typography>
          <Chip
            size="small"
            color={granted ? 'success' : 'error'}
            label={granted ? t('activityStream.granted', 'GRANTED') : t('activityStream.denied', 'DENIED')}
          />
        </Stack>
      </Box>
    </Box>
  )
}

export function ActivityStreamPage() {
  const { t } = useTranslation()
  const [result, setResult] = useState<'' | StreamResult>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['activity-stream', result, page] as const,
    queryFn: () => fetchStream({ page, page_size: PAGE_SIZE, result: result || undefined }),
    refetchInterval: 15000,
  })

  const rows = data?.results ?? []
  const pages = data?.pages ?? 1
  const currentPage = data?.page ?? page

  function changeFilter(value: '' | StreamResult) {
    setResult(value)
    setPage(1)
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h5">{t('nav.activity')}</Typography>
          <Chip
            size="small"
            variant="outlined"
            icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
            label={t('activityStream.live', 'Live')}
            sx={{ color: tokens.green, borderColor: `${tokens.green}66` }}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
          {t('activityStream.subtitle', 'Live audit feed')}
        </Typography>
      </Box>

      <SectionCard
        title={t('activityStream.feed', 'Audit Stream')}
        action={
          <TextField
            size="small"
            select
            label={t('activityStream.result', 'Result')}
            value={result}
            onChange={(e) => changeFilter(e.target.value as '' | StreamResult)}
            sx={{ minWidth: 150 }}
            inputProps={{ 'data-testid': 'stream-filter' }}
          >
            <MenuItem value="">{t('activityStream.all', 'All')}</MenuItem>
            {RESULT_OPTIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {r === 'GRANTED'
                  ? t('activityStream.granted', 'GRANTED')
                  : t('activityStream.denied', 'DENIED')}
              </MenuItem>
            ))}
          </TextField>
        }
      >
        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', height: 160 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ color: tokens.muted, py: 3, textAlign: 'center' }}>
            {t('activityStream.empty', 'No activity')}
          </Typography>
        ) : (
          <Box sx={{ pt: 1 }}>
            {rows.map((row, i) => (
              <TimelineRow key={row.id} row={row} last={i === rows.length - 1} />
            ))}
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={1}
          sx={{ mt: 1.5 }}
        >
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {t('activityStream.page', 'Page')} {currentPage} {t('activityStream.of', 'of')} {pages}
          </Typography>
          <IconButton
            size="small"
            aria-label={t('activityStream.prev', 'Previous')}
            data-testid="stream-prev"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={t('activityStream.next', 'Next')}
            data-testid="stream-next"
            disabled={currentPage >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </Stack>
      </SectionCard>
    </Stack>
  )
}

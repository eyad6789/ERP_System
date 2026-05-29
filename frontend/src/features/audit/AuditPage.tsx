import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GppMaybeIcon from '@mui/icons-material/GppMaybe'
import HistoryIcon from '@mui/icons-material/History'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { fetchAudit, fetchAuditStats, type AuditParams, type AuditResult } from '../../api/audit'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const RESULT_OPTIONS: AuditResult[] = ['GRANTED', 'DENIED']

// Draft state lives separately from the applied params so typing in the filter
// bar never triggers a fetch until the operator clicks Apply.
interface Draft {
  q: string
  action: string
  result: '' | AuditResult
  date_from: string
  date_to: string
}

const EMPTY_DRAFT: Draft = { q: '', action: '', result: '', date_from: '', date_to: '' }

export function AuditPage() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [filters, setFilters] = useState<Draft>(EMPTY_DRAFT)
  const [page, setPage] = useState(1)

  const statsQuery = useQuery({ queryKey: ['audit-stats'], queryFn: fetchAuditStats })

  const params: AuditParams = {
    q: filters.q || undefined,
    action: filters.action || undefined,
    result: filters.result || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    page,
  }
  const auditQuery = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => fetchAudit(params),
  })

  function apply() {
    setFilters(draft)
    setPage(1)
  }
  function clear() {
    setDraft(EMPTY_DRAFT)
    setFilters(EMPTY_DRAFT)
    setPage(1)
  }

  const stats = statsQuery.data
  const audit = auditQuery.data
  const pages = audit?.pages ?? 1
  const currentPage = audit?.page ?? page

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">{t('audit.title')}</Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
          {t('audit.subtitle')}
        </Typography>
      </Box>

      {statsQuery.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', height: 120 }}>
          <CircularProgress />
        </Box>
      ) : (
        stats && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box data-testid="audit-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('audit.total')}
                value={stats.total.toLocaleString()}
                accent={tokens.gold}
                icon={<HistoryIcon />}
              />
            </Box>
            <Box data-testid="audit-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('audit.granted')}
                value={stats.granted.toLocaleString()}
                accent={tokens.green}
                icon={<CheckCircleIcon />}
              />
            </Box>
            <Box data-testid="audit-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('audit.denied')}
                value={stats.denied.toLocaleString()}
                accent={tokens.red}
                icon={<GppMaybeIcon />}
              />
            </Box>
          </Box>
        )
      )}

      {stats && stats.by_day.length > 0 && (
        <SectionCard title={t('audit.activity')}>
          <Box data-testid="audit-chart" sx={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats.by_day}>
                <defs>
                  <linearGradient id="auditDeniedRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.red} />
                    <stop offset="100%" stopColor="#a04a3e" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={tokens.muted} fontSize={12} tickLine={false} />
                <YAxis stroke={tokens.muted} fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: tokens.surface2,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 8,
                    color: tokens.text,
                  }}
                  cursor={{ fill: 'rgba(201,162,39,0.06)' }}
                />
                <Bar
                  dataKey="granted"
                  name={t('audit.granted')}
                  stackId="a"
                  fill={tokens.green}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="denied"
                  name={t('audit.denied')}
                  stackId="a"
                  fill="url(#auditDeniedRed)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      )}

      <SectionCard title={t('audit.search')}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-end"
          flexWrap="wrap"
          useFlexGap
          sx={{ gap: 1.5 }}
        >
          <TextField
            size="small"
            label={t('audit.search')}
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            select
            label={t('audit.action')}
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">{t('audit.all')}</MenuItem>
            {(stats?.by_action ?? []).map((a) => (
              <MenuItem key={a.action} value={a.action}>
                {a.action}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            select
            label={t('audit.result')}
            value={draft.result}
            onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value as '' | AuditResult }))}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">{t('audit.all')}</MenuItem>
            {RESULT_OPTIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {r === 'GRANTED' ? t('audit.granted') : t('audit.denied')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label={t('audit.from')}
            value={draft.date_from}
            onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            size="small"
            type="date"
            label={t('audit.to')}
            value={draft.date_to}
            onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <Button variant="contained" onClick={apply}>
            {t('audit.apply')}
          </Button>
          <Button variant="outlined" onClick={clear}>
            {t('audit.clear')}
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard
        title={t('audit.title')}
        action={
          audit ? (
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {audit.count.toLocaleString()} {t('audit.total').toLowerCase()}
            </Typography>
          ) : undefined
        }
      >
        {auditQuery.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', height: 160 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('audit.time')}</TableCell>
                  <TableCell>{t('audit.actor')}</TableCell>
                  <TableCell>{t('audit.action')}</TableCell>
                  <TableCell>{t('audit.target')}</TableCell>
                  <TableCell>{t('audit.result')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(audit?.results ?? []).map((row) => (
                  <TableRow key={row.id} data-testid="audit-row">
                    <TableCell
                      sx={{ fontFamily: 'monospace', color: tokens.muted, whiteSpace: 'nowrap' }}
                    >
                      {row.ts.slice(11, 19)}
                    </TableCell>
                    <TableCell>{row.actor_label}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.action}</TableCell>
                    <TableCell sx={{ color: tokens.muted }}>
                      {row.target_type}:{row.target_id}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={row.result === 'GRANTED' ? 'success' : 'error'}
                        label={
                          row.result === 'GRANTED' ? t('audit.granted') : t('audit.denied')
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(audit?.results.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: tokens.muted, py: 3 }}>
                      {t('audit.noResults')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="flex-end"
              spacing={1}
              sx={{ mt: 1.5 }}
            >
              <Typography variant="caption" sx={{ color: tokens.muted }}>
                {t('audit.page')} {currentPage} {t('audit.of')} {pages}
              </Typography>
              <IconButton
                size="small"
                aria-label="prev"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="next"
                disabled={currentPage >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <NavigateNextIcon fontSize="small" />
              </IconButton>
            </Stack>
          </>
        )}
      </SectionCard>
    </Stack>
  )
}

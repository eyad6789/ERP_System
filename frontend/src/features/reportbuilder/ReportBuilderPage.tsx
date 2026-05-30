import DownloadIcon from '@mui/icons-material/Download'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../../api/client'
import { SectionCard } from '../../components/SectionCard'
import { chartColors, tokens } from '../../theme/tokens'

// Modules whose list endpoints return a top-level array we can aggregate.
const MODULES = [
  { value: 'personnel', path: '/personnel/' },
  { value: 'assets', path: '/assets/' },
  { value: 'incidents', path: '/incidents/' },
  { value: 'finance-contracts', path: '/contracts/' },
  { value: 'risk', path: '/risk/' },
  { value: 'projects', path: '/projects/' },
] as const

type ModuleValue = (typeof MODULES)[number]['value']

// Fields we may group by. We pick whichever the records actually carry.
const GROUP_FIELDS = ['classification', 'status'] as const
type GroupField = (typeof GROUP_FIELDS)[number]

const CHART_TYPES = ['bar', 'pie', 'table'] as const
type ChartType = (typeof CHART_TYPES)[number]

type ReportRecord = Record<string, unknown>

interface AggRow {
  key: string
  count: number
}

interface ReportDef {
  module: ModuleValue
  groupBy: GroupField
  chart: ChartType
  savedAt: string
}

const STORAGE_KEY = 'erp.reports'

const tooltipStyle = {
  background: tokens.surface2,
  border: `1px solid ${tokens.border}`,
  borderRadius: 8,
  color: tokens.text,
} as const

function loadSaved(): ReportDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ReportDef[]) : []
  } catch {
    return []
  }
}

// Aggregate record counts by the chosen field (missing values bucket as "—").
function aggregate(records: ReportRecord[], field: GroupField): AggRow[] {
  const counts = new Map<string, number>()
  for (const rec of records) {
    const raw = rec[field]
    const key = raw === undefined || raw === null ? '—' : String(raw)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

function toCsv(rows: AggRow[], header: [string, string]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [
    `${esc(header[0])},${esc(header[1])}`,
    ...rows.map((r) => `${esc(r.key)},${esc(r.count)}`),
  ]
  return lines.join('\r\n')
}

export function ReportBuilderPage() {
  const { t } = useTranslation()
  const [module, setModule] = useState<ModuleValue>('personnel')
  const [groupBy, setGroupBy] = useState<GroupField>('classification')
  const [chart, setChart] = useState<ChartType>('bar')
  const [rows, setRows] = useState<AggRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<ReportDef[]>(() => loadSaved())

  const path = MODULES.find((m) => m.value === module)?.path ?? '/personnel/'

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await api<ReportRecord[]>(path)
      const list = Array.isArray(records) ? records : []
      setRows(aggregate(list, groupBy))
    } catch {
      setError(t('reportBuilder.error', 'Could not load module data.'))
      setRows(null)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!rows) return
    const csv = toCsv(rows, [
      t(`reportBuilder.field.${groupBy}`, groupBy),
      t('reportBuilder.count', 'Count'),
    ])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `report-${module}-${groupBy}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSave = () => {
    const def: ReportDef = {
      module,
      groupBy,
      chart,
      savedAt: new Date().toISOString(),
    }
    const next = [def, ...saved].slice(0, 20)
    setSaved(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const handleLoad = (def: ReportDef) => {
    setModule(def.module)
    setGroupBy(def.groupBy)
    setChart(def.chart)
    setRows(null)
  }

  const total = rows?.reduce((sum, r) => sum + r.count, 0) ?? 0

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.reportbuilder', 'Report Builder')}</Typography>

      <SectionCard title={t('reportBuilder.designer', 'Report designer')}>
        <Stack
          direction="row"
          spacing={2}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          <TextField
            select
            size="small"
            label={t('reportBuilder.module', 'Module')}
            value={module}
            onChange={(e) => setModule(e.target.value as ModuleValue)}
            sx={{ minWidth: 200 }}
            slotProps={{ select: { native: true }, htmlInput: { 'data-testid': 'rb-module' } }}
          >
            {MODULES.map((m) => (
              <option key={m.value} value={m.value}>
                {t(`reportBuilder.modules.${m.value}`, m.value)}
              </option>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label={t('reportBuilder.groupBy', 'Group by')}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupField)}
            sx={{ minWidth: 180 }}
            slotProps={{ select: { native: true }, htmlInput: { 'data-testid': 'rb-groupby' } }}
          >
            {GROUP_FIELDS.map((f) => (
              <option key={f} value={f}>
                {t(`reportBuilder.field.${f}`, f)}
              </option>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label={t('reportBuilder.chart', 'Chart type')}
            value={chart}
            onChange={(e) => setChart(e.target.value as ChartType)}
            sx={{ minWidth: 160 }}
            slotProps={{ select: { native: true }, htmlInput: { 'data-testid': 'rb-chart' } }}
          >
            {CHART_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`reportBuilder.charts.${c}`, c)}
              </option>
            ))}
          </TextField>

          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleGenerate}
            disabled={loading}
            data-testid="rb-generate"
          >
            {t('reportBuilder.generate', 'Generate')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            data-testid="rb-save"
          >
            {t('reportBuilder.save', 'Save')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={!rows || rows.length === 0}
            data-testid="rb-export"
          >
            {t('reportBuilder.exportCsv', 'Export CSV')}
          </Button>
        </Stack>
      </SectionCard>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && rows && rows.length === 0 && (
        <Alert severity="info">{t('reportBuilder.empty', 'No records to aggregate.')}</Alert>
      )}

      {!loading && rows && rows.length > 0 && (
        <SectionCard
          title={`${t(`reportBuilder.modules.${module}`, module)} · ${t(
            `reportBuilder.field.${groupBy}`,
            groupBy,
          )} (${total})`}
        >
          {chart === 'table' && (
            <Table size="small" data-testid="rb-table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: tokens.muted }}>
                    {t(`reportBuilder.field.${groupBy}`, groupBy)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: tokens.muted }}>
                    {t('reportBuilder.count', 'Count')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} data-testid="rb-row">
                    <TableCell sx={{ color: tokens.text }}>{r.key}</TableCell>
                    <TableCell align="right" sx={{ color: tokens.text }}>
                      {r.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {chart === 'bar' && (
            <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 46)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={tokens.muted}
                  fontSize={12}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="key"
                  stroke={tokens.muted}
                  fontSize={12}
                  tickLine={false}
                  width={120}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
                <Bar
                  dataKey="count"
                  name={t('reportBuilder.count', 'Count')}
                  radius={[0, 6, 6, 0]}
                  data-testid="rb-bar"
                >
                  {rows.map((r, i) => (
                    <Cell key={r.key} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {chart === 'pie' && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="key"
                  innerRadius={56}
                  outerRadius={104}
                  paddingAngle={2}
                  label={(e: { value: number }) => `${e.value}`}
                  data-testid="rb-pie"
                >
                  {rows.map((r, i) => (
                    <Cell
                      key={r.key}
                      fill={chartColors[i % chartColors.length]}
                      stroke={tokens.surface}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      )}

      {saved.length > 0 && (
        <SectionCard title={t('reportBuilder.savedReports', 'Saved reports')}>
          <Stack spacing={1}>
            {saved.map((def, i) => (
              <Stack
                key={`${def.module}-${def.savedAt}-${i}`}
                direction="row"
                spacing={1.5}
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 1.5,
                  py: 1,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 1,
                }}
                data-testid="rb-saved-item"
              >
                <Typography sx={{ color: tokens.text }}>
                  {t(`reportBuilder.modules.${def.module}`, def.module)} ·{' '}
                  {t(`reportBuilder.field.${def.groupBy}`, def.groupBy)} ·{' '}
                  {t(`reportBuilder.charts.${def.chart}`, def.chart)}
                </Typography>
                <Button size="small" onClick={() => handleLoad(def)} data-testid="rb-saved-load">
                  {t('reportBuilder.load', 'Load')}
                </Button>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  )
}

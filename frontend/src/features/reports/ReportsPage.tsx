import DownloadIcon from '@mui/icons-material/Download'
import InsightsIcon from '@mui/icons-material/Insights'
import LayersIcon from '@mui/icons-material/Layers'
import SecurityIcon from '@mui/icons-material/Security'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
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

import { fetchOverview, type OverviewModules } from '../../api/dashboard'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { classification, tokens } from '../../theme/tokens'

const tooltipStyle = {
  background: tokens.surface2,
  border: `1px solid ${tokens.border}`,
  borderRadius: 8,
  color: tokens.text,
} as const

// Modules carrying a `total` count we can chart as "records per module".
// `finance` is intentionally excluded (it has no record count, only money).
const MODULE_KEYS = [
  'personnel',
  'documents',
  'operations',
  'assets',
  'incidents',
  'gis',
] as const
type ModuleKey = (typeof MODULE_KEYS)[number]

interface ModuleTotal {
  key: ModuleKey
  label: string
  total: number
}

function moduleTotals(
  modules: OverviewModules,
  label: (key: ModuleKey) => string,
): ModuleTotal[] {
  const rows: ModuleTotal[] = []
  for (const key of MODULE_KEYS) {
    const mod = modules[key]
    if (mod) rows.push({ key, label: label(key), total: mod.total })
  }
  return rows.sort((a, b) => b.total - a.total)
}

// Serialize per-module totals to a CSV string (header + one row per module).
function toCsv(rows: ModuleTotal[], header: [string, string]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [
    `${esc(header[0])},${esc(header[1])}`,
    ...rows.map((r) => `${esc(r.label)},${esc(r.total)}`),
  ]
  return lines.join('\r\n')
}

export function ReportsPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: fetchOverview,
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (isError || !data) {
    return <Typography color="error">{t('common.loading')}</Typography>
  }

  const rows = moduleTotals(data.modules, (key) => t(`nav.${key}`))
  const totalRecords = rows.reduce((sum, r) => sum + r.total, 0)

  const pieData = data.clearance_distribution
    .filter((d) => d.count > 0) // drop empty (0-count) slices
    .map((d) => ({
      name: t(`clearance.${d.level}`),
      value: d.count,
      color: classification[d.level as 1 | 2 | 3 | 4]?.color ?? tokens.cyan,
    }))
  const clearedRecords = pieData.reduce((sum, d) => sum + d.value, 0)

  const handleExport = () => {
    const csv = toCsv(rows, [t('reports.module', 'Module'), t('reports.total', 'Total')])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'module-totals.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1.5}
      >
        <Typography variant="h5">{t('nav.reports')}</Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          data-testid="reports-export"
        >
          {t('reports.exportCsv', 'Export CSV')}
        </Button>
      </Stack>

      {/* Headline totals */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('reports.totalRecords', 'Total records')}
          value={totalRecords}
          accent={tokens.gold}
          icon={<LayersIcon />}
        />
        <StatCard
          label={t('reports.modulesTracked', 'Modules tracked')}
          value={rows.length}
          accent={tokens.cyan}
          icon={<InsightsIcon />}
        />
        <StatCard
          label={t('reports.classifiedRecords', 'Classified records')}
          value={clearedRecords}
          accent={tokens.goldBright}
          icon={<SecurityIcon />}
        />
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="stretch">
        {/* Records per module */}
        <SectionCard title={t('reports.recordsPerModule', 'Records per module')} sx={{ flex: 2 }}>
          <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 46)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 24 }}>
              <defs>
                <linearGradient id="reportBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={tokens.goldDim} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={tokens.gold} stopOpacity={0.95} />
                </linearGradient>
              </defs>
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
                dataKey="label"
                stroke={tokens.muted}
                fontSize={12}
                tickLine={false}
                width={96}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
              <Bar
                dataKey="total"
                fill="url(#reportBar)"
                name={t('reports.total', 'Total')}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Clearance distribution */}
        <SectionCard title={t('reports.clearanceMix', 'Clearance mix')} sx={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={86}
                paddingAngle={2}
                label={(e: { value: number }) => `${e.value}`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={tokens.surface} strokeWidth={2} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(201,162,39,0.06)' }} />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </Stack>
    </Stack>
  )
}

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  fetchContracts,
  fetchFinanceSummary,
  type ContractListItem,
} from '../../api/finance'
import { ClassificationBadge } from '../../components/ClassificationBadge'

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  signed: 'info',
  in_progress: 'warning',
  under_review: 'default',
  completed: 'success',
}

function formatAmount(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString()
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card sx={{ minWidth: 220, flex: 1 }} data-testid="finance-kpi">
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

function ContractRow({ contract }: { contract: ContractListItem }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? contract.title_ar : contract.title_en
  const statusColor = STATUS_COLOR[contract.status] ?? 'default'

  return (
    <TableRow data-testid={contract.locked ? 'contract-locked' : 'contract-open'}>
      <TableCell>{contract.locked ? '—' : title}</TableCell>
      <TableCell>{contract.locked ? '—' : contract.vendor}</TableCell>
      <TableCell>
        <Chip size="small" color={statusColor} label={t(`finance.status.${contract.status}`)} />
      </TableCell>
      <TableCell sx={{ minWidth: 140 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <LinearProgress variant="determinate" value={contract.progress} />
          </Box>
          <Typography variant="caption">{contract.progress}%</Typography>
        </Stack>
      </TableCell>
      <TableCell align="right">
        {contract.locked || contract.value === null ? '—' : formatAmount(contract.value)}
      </TableCell>
      <TableCell>
        <ClassificationBadge level={contract.classification} />
      </TableCell>
    </TableRow>
  )
}

export function FinancePage() {
  const { t } = useTranslation()
  const summaryQuery = useQuery({ queryKey: ['finance-summary'], queryFn: fetchFinanceSummary })
  const contractsQuery = useQuery({ queryKey: ['finance-contracts'], queryFn: fetchContracts })

  if (summaryQuery.isLoading || contractsQuery.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const summary = summaryQuery.data
  const contracts = contractsQuery.data ?? []
  const chartData = (summary?.by_department ?? []).map((d) => ({
    department: d.department_code,
    amount: Number(d.amount),
  }))

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.finance')}</Typography>

      {summary && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <KpiCard label={t('finance.total')} value={formatAmount(summary.total_amount)} />
          <KpiCard label={t('finance.spent')} value={formatAmount(summary.spent)} />
          <KpiCard label={t('finance.remaining')} value={formatAmount(summary.remaining)} />
        </Box>
      )}

      {chartData.length > 0 && (
        <Paper sx={{ p: 2 }} data-testid="finance-chart">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('finance.byDepartment')}
          </Typography>
          <Box sx={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#cda434" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('finance.title')}</TableCell>
              <TableCell>{t('finance.vendor')}</TableCell>
              <TableCell>{t('finance.statusLabel')}</TableCell>
              <TableCell>{t('finance.progress')}</TableCell>
              <TableCell align="right">{t('finance.value')}</TableCell>
              <TableCell>{t('finance.classification')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contracts.map((c) => (
              <ContractRow key={c.id} contract={c} />
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}

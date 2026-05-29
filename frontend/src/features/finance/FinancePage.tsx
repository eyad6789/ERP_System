import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import LockIcon from '@mui/icons-material/Lock'
import PaymentsIcon from '@mui/icons-material/Payments'
import SavingsIcon from '@mui/icons-material/Savings'
import {
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
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

import { fetchContracts, fetchFinanceSummary, type ContractListItem } from '../../api/finance'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'primary'> = {
  signed: 'info',
  in_progress: 'primary',
  under_review: 'warning',
  completed: 'success',
}

function formatAmount(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString()
}

function ContractRow({ contract }: { contract: ContractListItem }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? contract.title_ar : contract.title_en
  const statusColor = STATUS_COLOR[contract.status] ?? 'default'

  return (
    <TableRow data-testid={contract.locked ? 'contract-locked' : 'contract-open'}>
      <TableCell>
        {contract.locked ? (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: tokens.muted }}>
            <LockIcon sx={{ fontSize: 15 }} />
            <Typography variant="body2" component="span">
              —
            </Typography>
          </Stack>
        ) : (
          title
        )}
      </TableCell>
      <TableCell sx={{ color: contract.locked ? tokens.muted : undefined }}>
        {contract.locked ? '—' : contract.vendor}
      </TableCell>
      <TableCell>
        <Chip size="small" color={statusColor} label={t(`finance.status.${contract.status}`)} />
      </TableCell>
      <TableCell sx={{ minWidth: 160 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={contract.progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: tokens.surface3,
                '& .MuiLinearProgress-bar': { backgroundColor: tokens.gold, borderRadius: 3 },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: tokens.muted, minWidth: 32 }}>
            {contract.progress}%
          </Typography>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ color: contract.locked ? tokens.muted : undefined }}>
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
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.finance')}</Typography>
        <Chip size="small" variant="outlined" label={contracts.length} />
      </Stack>

      {summary && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.total')}
              value={formatAmount(summary.total_amount)}
              accent={tokens.gold}
              icon={<AccountBalanceWalletIcon />}
            />
          </Box>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.spent')}
              value={formatAmount(summary.spent)}
              accent={tokens.orange}
              icon={<PaymentsIcon />}
            />
          </Box>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.remaining')}
              value={formatAmount(summary.remaining)}
              accent={tokens.green}
              icon={<SavingsIcon />}
            />
          </Box>
        </Box>
      )}

      {chartData.length > 0 && (
        <SectionCard title={t('finance.byDepartment')}>
          <Box data-testid="finance-chart" sx={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="financeBarGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.goldBright} />
                    <stop offset="100%" stopColor={tokens.gold} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="department"
                  stroke={tokens.muted}
                  fontSize={12}
                  tickLine={false}
                />
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
                <Bar dataKey="amount" fill="url(#financeBarGold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      )}

      <SectionCard title={t('finance.statusLabel')}>
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
      </SectionCard>
    </Stack>
  )
}

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchAssets, type AssetCondition, type AssetListItem } from '../../api/assets'
import { ClassificationBadge } from '../../components/ClassificationBadge'

const CONDITION_COLOR: Record<AssetCondition, 'success' | 'warning' | 'error'> = {
  operational: 'success',
  maintenance: 'warning',
  down: 'error',
}

function KpiCard({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card sx={{ minWidth: 160 }} data-testid={testId}>
      <CardContent>
        <Typography variant="h4">{value}</Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  )
}

export function AssetsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const { data, isLoading } = useQuery({ queryKey: ['assets'], queryFn: fetchAssets })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const assets: AssetListItem[] = data ?? []
  const count = (c: AssetCondition) => assets.filter((a) => a.condition === c).length

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.assets')}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <KpiCard label={t('assets.total')} value={assets.length} testId="kpi-total" />
        <KpiCard label={t('assets.operational')} value={count('operational')} testId="kpi-operational" />
        <KpiCard label={t('assets.maintenance')} value={count('maintenance')} testId="kpi-maintenance" />
        <KpiCard label={t('assets.down')} value={count('down')} testId="kpi-down" />
      </Box>
      <TableContainer component={Card}>
        <Table data-testid="assets-table">
          <TableHead>
            <TableRow>
              <TableCell>{t('assets.name')}</TableCell>
              <TableCell>{t('assets.type')}</TableCell>
              <TableCell>{t('assets.location')}</TableCell>
              <TableCell>{t('assets.condition')}</TableCell>
              <TableCell>{t('assets.classification')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id} data-testid="asset-row">
                <TableCell>{ar ? a.name_ar : a.name_en}</TableCell>
                <TableCell>{a.asset_type}</TableCell>
                <TableCell>{a.location}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={CONDITION_COLOR[a.condition]}
                    label={t(`assets.${a.condition}`)}
                  />
                </TableCell>
                <TableCell>
                  <ClassificationBadge level={a.classification} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

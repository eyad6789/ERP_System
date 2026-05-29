import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import {
  Box,
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
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CONDITION_COLOR: Record<AssetCondition, 'success' | 'warning' | 'error'> = {
  operational: 'success',
  maintenance: 'warning',
  down: 'error',
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
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.assets')}</Typography>
        <Chip size="small" label={assets.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.total')}
            value={assets.length}
            accent={tokens.gold}
            icon={<Inventory2Icon />}
          />
        </Box>
        <Box data-testid="kpi-operational" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.operational')}
            value={count('operational')}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
        <Box data-testid="kpi-maintenance" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.maintenance')}
            value={count('maintenance')}
            accent={tokens.orange}
            icon={<BuildIcon />}
          />
        </Box>
        <Box data-testid="kpi-down" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.down')}
            value={count('down')}
            accent={tokens.red}
            icon={<ErrorOutlineIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('nav.assets')}>
        <TableContainer>
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
      </SectionCard>
    </Stack>
  )
}

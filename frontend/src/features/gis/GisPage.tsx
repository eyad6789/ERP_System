import CloseIcon from '@mui/icons-material/Close'
import PlaceIcon from '@mui/icons-material/Place'
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchSite, fetchSites, type SiteType } from '../../api/gis'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { IraqMap } from '../../components/IraqMap'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const SITE_TYPES: SiteType[] = ['facility', 'unit', 'asset']

function SitePopup({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Selecting a marker hits the IDOR-safe detail endpoint, which audits the read.
  const { data } = useQuery({ queryKey: ['site', id], queryFn: () => fetchSite(id) })

  return (
    <Box
      data-testid="gis-popup"
      sx={{
        position: 'absolute',
        insetInlineEnd: 16,
        top: 16,
        width: 250,
        p: 2,
        borderRadius: 2,
        bgcolor: tokens.surface2,
        border: `1px solid ${tokens.borderGold}`,
        boxShadow: '0 18px 40px -20px rgba(0,0,0,0.9)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">
          {data ? (ar ? data.name_ar : data.name_en) : t('common.loading')}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {data && (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {ar ? data.info_ar : data.info_en}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={t(`gis.type.${data.site_type}`)} />
            <ClassificationBadge level={data.classification} />
          </Stack>
        </Stack>
      )}
    </Box>
  )
}

export function GisPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [selected, setSelected] = useState<number | null>(null)
  const [active, setActive] = useState<Record<SiteType, boolean>>({
    facility: true,
    unit: true,
    asset: true,
  })
  const { data, isLoading } = useQuery({ queryKey: ['sites'], queryFn: fetchSites })

  const sites = useMemo(() => (data ?? []).filter((s) => active[s.site_type]), [data, active])

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="h5">{t('nav.gis')}</Typography>
        <FormGroup row>
          {SITE_TYPES.map((tp) => (
            <FormControlLabel
              key={tp}
              control={
                <Checkbox
                  size="small"
                  checked={active[tp]}
                  onChange={(e) => setActive((a) => ({ ...a, [tp]: e.target.checked }))}
                />
              }
              label={t(`gis.type.${tp}`)}
            />
          ))}
        </FormGroup>
      </Stack>

      <SectionCard title={t('nav.gis')}>
        <Box sx={{ position: 'relative' }}>
          <IraqMap sites={sites} ar={ar} onSelect={setSelected} />
          {selected !== null && <SitePopup id={selected} onClose={() => setSelected(null)} />}
        </Box>
        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
          {sites.map((s) => (
            <Stack
              key={s.id}
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ cursor: 'pointer', color: tokens.muted }}
              onClick={() => setSelected(s.id)}
            >
              <PlaceIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption">{ar ? s.name_ar : s.name_en}</Typography>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  )
}

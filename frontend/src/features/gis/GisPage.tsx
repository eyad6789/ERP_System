import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchSite, fetchSites, type Site, type SiteType } from '../../api/gis'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { classification, tokens } from '../../theme/tokens'

// Iraq bounding box used to project lat/lng into the offline map container.
// MapLibre GL is the production path; the demo uses projected markers (offline).
const BBOX = { latMin: 29, latMax: 37.5, lngMin: 38.5, lngMax: 48.8 }
const SITE_TYPES: SiteType[] = ['facility', 'unit', 'asset']

function project(site: Site): { left: string; top: string } {
  const x = (site.lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)
  const y = (BBOX.latMax - site.lat) / (BBOX.latMax - BBOX.latMin)
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return { left: `${clamp(x) * 100}%`, top: `${clamp(y) * 100}%` }
}

function markerColor(level: number): string {
  return classification[level as 1 | 2 | 3 | 4]?.color ?? tokens.muted
}

function SitePopup({ site }: { site: Site }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Selecting a marker hits the IDOR-safe detail endpoint, which audits the read.
  const { data } = useQuery({ queryKey: ['site', site.id], queryFn: () => fetchSite(site.id) })
  const detail = data ?? site

  return (
    <Paper
      data-testid="gis-popup"
      elevation={6}
      sx={{
        position: 'absolute',
        left: project(site).left,
        top: project(site).top,
        transform: 'translate(12px, -50%)',
        p: 1.5,
        maxWidth: 220,
        zIndex: 5,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{ar ? detail.name_ar : detail.name_en}</Typography>
        <ClassificationBadge level={detail.classification} />
        <Typography variant="caption" color="text.secondary">
          {ar ? detail.info_ar : detail.info_en}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`gis.type.${detail.site_type}`)}
        </Typography>
      </Stack>
    </Paper>
  )
}

export function GisPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Site | null>(null)
  const [active, setActive] = useState<Record<SiteType, boolean>>({
    facility: true,
    unit: true,
    asset: true,
  })
  const { data, isLoading } = useQuery({ queryKey: ['sites'], queryFn: fetchSites })

  const sites = useMemo(() => data ?? [], [data])
  const visible = useMemo(() => sites.filter((s) => active[s.site_type]), [sites, active])

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.gis')}</Typography>
      <FormGroup row data-testid="gis-layers">
        {SITE_TYPES.map((type) => (
          <FormControlLabel
            key={type}
            control={
              <Checkbox
                checked={active[type]}
                onChange={(e) => setActive((p) => ({ ...p, [type]: e.target.checked }))}
                inputProps={{ 'aria-label': t(`gis.type.${type}`) }}
              />
            }
            label={t(`gis.type.${type}`)}
          />
        ))}
      </FormGroup>
      <Box
        data-testid="gis-map"
        sx={{
          position: 'relative',
          width: '100%',
          height: 520,
          borderRadius: 2,
          border: `1px solid ${tokens.border}`,
          backgroundColor: tokens.bg,
          backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          overflow: 'hidden',
        }}
        onClick={() => setSelected(null)}
      >
        {visible.map((site) => {
          const pos = project(site)
          return (
            <Box
              key={site.id}
              data-testid="gis-marker"
              role="button"
              aria-label={site.name_en}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(site)
              }}
              sx={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                transform: 'translate(-50%, -50%)',
                width: 16,
                height: 16,
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor: markerColor(site.classification),
                border: `2px solid ${tokens.text}`,
                boxShadow: `0 0 8px ${markerColor(site.classification)}`,
              }}
            />
          )
        })}
        {selected && <SitePopup site={selected} />}
      </Box>
    </Stack>
  )
}

import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PlaceIcon from '@mui/icons-material/Place'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createSite,
  fetchSite,
  fetchSites,
  removeSite,
  type Site,
  type SiteInput,
  type SiteType,
  updateSite,
} from '../../api/gis'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { IraqMap } from '../../components/IraqMap'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const SITE_TYPES: SiteType[] = ['facility', 'unit', 'asset']
const CLEARANCES = [1, 2, 3, 4] as const

// Sortable columns exposed as an ordering Select; value maps to the API ?ordering=.
const ORDERINGS = ['name_en', 'name_ar', 'site_type', 'classification'] as const
type Ordering = (typeof ORDERINGS)[number]

function emptyDraft(): SiteInput {
  return {
    name_ar: '',
    name_en: '',
    site_type: 'facility',
    lat: 0,
    lng: 0,
    info_ar: '',
    info_en: '',
    classification: 1,
  }
}

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

function SiteFormDialog({
  initial,
  onClose,
  onSubmit,
  saving,
}: {
  initial: SiteInput
  onClose: () => void
  onSubmit: (draft: SiteInput) => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<SiteInput>(initial)

  const set = <K extends keyof SiteInput>(key: K, value: SiteInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const valid = draft.name_ar.trim() !== '' && draft.name_en.trim() !== ''

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" data-testid="gis-form-dialog">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('common.new')}
        <IconButton size="small" onClick={onClose} aria-label="close" sx={{ color: tokens.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              label="name_ar"
              required
              value={draft.name_ar}
              onChange={(e) => set('name_ar', e.target.value)}
            />
            <TextField
              fullWidth
              label="name_en"
              required
              value={draft.name_en}
              onChange={(e) => set('name_en', e.target.value)}
            />
          </Stack>
          <FormControl fullWidth>
            <InputLabel id="gis-site-type-label">site_type</InputLabel>
            <Select
              labelId="gis-site-type-label"
              label="site_type"
              value={draft.site_type}
              onChange={(e) => set('site_type', e.target.value as SiteType)}
            >
              {SITE_TYPES.map((tp) => (
                <MenuItem key={tp} value={tp}>
                  {t(`gis.type.${tp}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              type="number"
              label="lat"
              value={draft.lat}
              onChange={(e) => set('lat', Number(e.target.value))}
            />
            <TextField
              fullWidth
              type="number"
              label="lng"
              value={draft.lng}
              onChange={(e) => set('lng', Number(e.target.value))}
            />
          </Stack>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="info_ar"
            value={draft.info_ar}
            onChange={(e) => set('info_ar', e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="info_en"
            value={draft.info_en}
            onChange={(e) => set('info_en', e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel id="gis-classification-label">{t('personnel.clearance')}</InputLabel>
            <Select
              labelId="gis-classification-label"
              label={t('personnel.clearance')}
              value={draft.classification}
              onChange={(e) => set('classification', Number(e.target.value))}
            >
              {CLEARANCES.map((n) => (
                <MenuItem key={n} value={n}>
                  {t(`clearance.${n}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() => onSubmit(draft)}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const { t } = useTranslation()
  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth data-testid="gis-delete-dialog">
      <DialogTitle>{t('common.confirm')}</DialogTitle>
      <DialogContent>
        <Typography>{t('common.confirmDelete')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button color="error" variant="contained" disabled={busy} onClick={onConfirm}>
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function GisPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState<number | null>(null)
  const [active, setActive] = useState<Record<SiteType, boolean>>({
    facility: true,
    unit: true,
    asset: true,
  })

  // Search box (immediate) debounced into the query key after 300ms.
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [ordering, setOrdering] = useState<Ordering>('name_en')

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Site | null>(null)
  const [deleting, setDeleting] = useState<Site | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['sites', q, ordering],
    queryFn: () => fetchSites({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sites'] })

  const createMutation = useMutation({
    mutationFn: (body: SiteInput) => createSite(body),
    onSuccess: () => {
      setCreating(false)
      void invalidate()
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: SiteInput }) => updateSite(id, body),
    onSuccess: () => {
      setEditing(null)
      void invalidate()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeSite(id),
    onSuccess: () => {
      setDeleting(null)
      void invalidate()
    },
  })

  const sites = useMemo(() => (data ?? []).filter((s) => active[s.site_type]), [data, active])

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
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <TextField
            size="small"
            placeholder={t('common.searchHere')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'data-testid': 'gis-search' }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="gis-ordering-label">{t('common.actions')}</InputLabel>
            <Select
              labelId="gis-ordering-label"
              label={t('common.actions')}
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as Ordering)}
              data-testid="gis-ordering"
            >
              {ORDERINGS.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreating(true)}
            data-testid="gis-new"
          >
            {t('common.new')}
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
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
          {isLoading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', height: 320 }}>
              <CircularProgress />
            </Box>
          ) : (
            <IraqMap sites={sites} ar={ar} onSelect={setSelected} />
          )}
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

      <SectionCard title={t('nav.gis')}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>name</TableCell>
              <TableCell>site_type</TableCell>
              <TableCell>{t('personnel.clearance')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sites.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ color: tokens.text }}>{ar ? s.name_ar : s.name_en}</TableCell>
                <TableCell>{t(`gis.type.${s.site_type}`)}</TableCell>
                <TableCell>
                  <ClassificationBadge level={s.classification} />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('common.edit')}
                    onClick={() => setEditing(s)}
                    sx={{ color: tokens.gold }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleting(s)}
                    sx={{ color: tokens.red }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {creating && (
        <SiteFormDialog
          initial={emptyDraft()}
          saving={createMutation.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(draft) => createMutation.mutate(draft)}
        />
      )}
      {editing && (
        <SiteFormDialog
          initial={{
            name_ar: editing.name_ar,
            name_en: editing.name_en,
            site_type: editing.site_type,
            lat: editing.lat,
            lng: editing.lng,
            info_ar: editing.info_ar,
            info_en: editing.info_en,
            classification: editing.classification,
          }}
          saving={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(draft) => updateMutation.mutate({ id: editing.id, body: draft })}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          busy={deleteMutation.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
        />
      )}
    </Stack>
  )
}

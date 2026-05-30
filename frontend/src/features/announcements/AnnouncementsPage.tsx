import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CampaignIcon from '@mui/icons-material/Campaign'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import GroupsIcon from '@mui/icons-material/Groups'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createAnnouncement,
  fetchAnnouncements,
  removeAnnouncement,
  updateAnnouncement,
  type AnnouncementListItem,
  type AnnouncementWriteBody,
} from '../../api/announcements'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField =
  | 'title_en'
  | 'audience'
  | 'published_date'
  | 'classification'

const EMPTY_FORM: AnnouncementWriteBody = {
  title_ar: '',
  title_en: '',
  audience: '',
  published_date: '',
  body: '',
  classification: 1,
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function AnnouncementFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: AnnouncementWriteBody
  onClose: () => void
  onSubmit: (body: AnnouncementWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AnnouncementWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.title_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={`${t('announcements.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('announcements.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            label={t('announcements.audience', 'Audience')}
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-audience' }}
          />
          <TextField
            type="date"
            label={t('announcements.published_date', 'Published date')}
            value={form.published_date}
            onChange={(e) => setForm((f) => ({ ...f, published_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-published_date' }}
          />
          <TextField
            label={t('announcements.body', 'Body')}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
            inputProps={{ 'data-testid': 'field-body' }}
          />
          <TextField
            select
            label={t('announcements.classification', 'Classification')}
            value={form.classification}
            onChange={(e) =>
              setForm((f) => ({ ...f, classification: Number(e.target.value) }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-classification' }}
          >
            {CLEARANCES.map((n) => (
              <MenuItem key={n} value={n}>
                {t(`clearance.${n}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || pending}
          onClick={() => onSubmit(form)}
          data-testid="form-submit"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function AnnouncementsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('published_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementListItem | null>(null)
  const [deleting, setDeleting] = useState<AnnouncementListItem | null>(null)

  const queryKey = ['announcements', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAnnouncements({ q, ordering }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['announcements'] })

  const createMutation = useMutation({
    mutationFn: (body: AnnouncementWriteBody) => createAnnouncement(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AnnouncementWriteBody }) =>
      updateAnnouncement(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeAnnouncement(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: AnnouncementWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            audience: editing.audience,
            published_date: editing.published_date,
            body: editing.body,
            classification: editing.classification,
          }
        : EMPTY_FORM,
    [editing],
  )

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleSubmit = (body: AnnouncementWriteBody) => {
    if (editing) updateMutation.mutate({ id: editing.id, body })
    else createMutation.mutate(body)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const announcements: AnnouncementListItem[] = data ?? []
  const audiences = new Set(
    announcements.map((a) => a.audience).filter((a) => a.trim() !== ''),
  ).size

  const sortHeader = (field: SortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDir : 'asc'}
      onClick={() => handleSort(field)}
      IconComponent={sortDir === 'desc' ? ArrowDownwardIcon : ArrowUpwardIcon}
    >
      {label}
    </TableSortLabel>
  )

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.announcements')}</Typography>
        <Chip size="small" label={announcements.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('announcements.total', 'Total')}
            value={announcements.length}
            accent={tokens.gold}
            icon={<CampaignIcon />}
          />
        </Box>
        <Box data-testid="kpi-audiences" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('announcements.audiences', 'Audiences')}
            value={audiences}
            accent={tokens.green}
            icon={<GroupsIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.announcements')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'announcements-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="announcement-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="announcements-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('announcements.title', 'Title'))}</TableCell>
                <TableCell>{sortHeader('audience', t('announcements.audience', 'Audience'))}</TableCell>
                <TableCell>
                  {sortHeader('published_date', t('announcements.published_date', 'Published date'))}
                </TableCell>
                <TableCell>
                  {sortHeader('classification', t('announcements.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {announcements.map((a) => (
                <TableRow key={a.id} data-testid="announcement-row">
                  <TableCell>{ar ? a.title_ar : a.title_en}</TableCell>
                  <TableCell>{a.audience}</TableCell>
                  <TableCell>{a.published_date}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={a.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="announcement-edit"
                      onClick={() => {
                        setEditing(a)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="announcement-delete"
                      onClick={() => setDeleting(a)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <AnnouncementFormDialog
        open={formOpen}
        initial={formInitial}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        pending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs">
        <DialogTitle>{t('common.delete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('common.confirmDelete')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleting) deleteMutation.mutate(deleting.id)
            }}
            data-testid="confirm-delete"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

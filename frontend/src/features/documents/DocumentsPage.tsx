import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import HistoryIcon from '@mui/icons-material/History'
import LockIcon from '@mui/icons-material/Lock'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  addDocumentVersion,
  createDocument,
  fetchDocument,
  fetchDocuments,
  removeDocument,
  updateDocument,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentWrite,
} from '../../api/documents'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCE_LEVELS = [1, 2, 3, 4] as const

// Whitelisted ordering fields (must mirror the backend ORDERING_WHITELIST).
const ORDERING_OPTIONS = [
  { value: 'title_en', labelKey: 'documents.sortTitle', fallback: 'Title' },
  { value: 'classification', labelKey: 'documents.sortClassification', fallback: 'Classification' },
  { value: '-version', labelKey: 'documents.sortVersion', fallback: 'Version' },
  { value: '-updated_at', labelKey: 'documents.sortUpdated', fallback: 'Recently updated' },
] as const

const EMPTY_FORM: DocumentWrite = { title_ar: '', title_en: '', body: '', classification: 1 }

interface DocumentFormProps {
  open: boolean
  initial?: DocumentWrite
  title: string
  saving: boolean
  onClose: () => void
  onSubmit: (value: DocumentWrite) => void
}

function DocumentForm({ open, initial, title, saving, onClose, onSubmit }: DocumentFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<DocumentWrite>(initial ?? EMPTY_FORM)

  // Reseed the form whenever the dialog (re)opens for a different record.
  useEffect(() => {
    if (open) setForm(initial ?? EMPTY_FORM)
  }, [open, initial])

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label={`${t('documents.titleAr', 'Title (AR)')} *`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'doc-form-title-ar', dir: 'rtl' }}
          />
          <TextField
            label={`${t('documents.titleEn', 'Title (EN)')} *`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'doc-form-title-en' }}
          />
          <TextField
            label={t('documents.body', 'Body')}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            fullWidth
            multiline
            minRows={4}
            inputProps={{ 'data-testid': 'doc-form-body' }}
          />
          <FormControl fullWidth>
            <InputLabel id="doc-classification-label">{t('personnel.clearance')}</InputLabel>
            <Select
              labelId="doc-classification-label"
              label={t('personnel.clearance')}
              value={form.classification}
              onChange={(e) =>
                setForm((f) => ({ ...f, classification: Number(e.target.value) }))
              }
              data-testid="doc-form-classification"
            >
              {CLEARANCE_LEVELS.map((n) => (
                <MenuItem key={n} value={n}>
                  {t(`clearance.${n}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || saving}
          onClick={() => onSubmit(form)}
          data-testid="doc-form-submit"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DetailDialog({
  id,
  onClose,
  onEdit,
}: {
  id: number
  onClose: () => void
  onEdit: (doc: DocumentDetail) => void
}) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()
  // Opening a document hits the IDOR-safe detail endpoint, which access-logs the read.
  const { data, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id),
  })

  const addVersion = useMutation({
    mutationFn: () => {
      const note = data?.body ?? ''
      return addDocumentVersion(id, { note_ar: note, note_en: note, body: note })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document', id] })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isLoading || !data ? t('common.loading') : ar ? data.title_ar : data.title_en}
      </DialogTitle>
      <DialogContent>
        {isLoading || !data ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ClassificationBadge level={data.classification} />
              <Chip size="small" label={`v${data.version}`} sx={{ fontWeight: 700 }} />
              <Chip
                size="small"
                variant="outlined"
                icon={<VisibilityIcon sx={{ fontSize: 15 }} />}
                label={`${t('documents.access')}: ${data.access_count}`}
              />
              {data.owner && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${t('documents.owner')}: ${data.owner}`}
                />
              )}
            </Stack>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: tokens.surface,
                border: `1px solid ${tokens.border}`,
              }}
            >
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.body}</Typography>
            </Box>
            <Divider />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 3, height: 16, background: tokens.gold, borderRadius: 2 }} />
              <Typography variant="subtitle2">{t('documents.versionHistory')}</Typography>
            </Stack>
            <Stack spacing={0}>
              {data.versions.map((v) => (
                <Stack
                  key={v.number}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{
                    fontSize: 13,
                    py: 1,
                    borderBottom: `1px solid ${tokens.border}`,
                    '&:last-of-type': { borderBottom: 'none' },
                  }}
                >
                  <Chip
                    size="small"
                    label={`v${v.number}`}
                    sx={{ minWidth: 44, color: tokens.gold, borderColor: tokens.borderGold }}
                    variant="outlined"
                  />
                  <Box component="span" sx={{ flex: 1, color: tokens.text }}>
                    {ar ? v.note_ar : v.note_en}
                  </Box>
                  <Box component="span" sx={{ color: tokens.muted }}>
                    {v.created_at.slice(0, 10)}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.close')}
        </Button>
        <Button
          startIcon={<HistoryIcon />}
          disabled={!data || addVersion.isPending}
          onClick={() => addVersion.mutate()}
          data-testid="doc-add-version"
        >
          {t('documents.addVersion', 'Add version')}
        </Button>
        <Button
          variant="contained"
          startIcon={<EditOutlinedIcon />}
          disabled={!data}
          onClick={() => data && onEdit(data)}
          data-testid="doc-detail-edit"
        >
          {t('common.edit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DocCard({
  doc,
  onOpen,
  onEdit,
  onDelete,
}: {
  doc: DocumentListItem
  onOpen: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (doc: DocumentListItem) => void
}) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? doc.title_ar : doc.title_en

  const header = (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <ClassificationBadge level={doc.classification} />
      <Chip size="small" label={`v${doc.version}`} sx={{ fontWeight: 700 }} />
    </Stack>
  )

  const footer = (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      justifyContent="space-between"
      sx={{ mt: 1.5, color: tokens.muted }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <VisibilityIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption">
          {t('documents.access')}: {doc.access_count}
        </Typography>
      </Stack>
      {!doc.locked && (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={t('common.edit')}>
            <IconButton
              size="small"
              onClick={() => onEdit(doc.id)}
              data-testid={`doc-edit-${doc.id}`}
              sx={{ color: tokens.muted }}
            >
              <EditOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('common.delete')}>
            <IconButton
              size="small"
              onClick={() => onDelete(doc)}
              data-testid={`doc-delete-${doc.id}`}
              sx={{ color: tokens.red }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  )

  if (doc.locked) {
    return (
      <Card sx={{ width: 300 }} data-testid="doc-locked">
        <CardContent>
          {header}
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1}
            sx={{
              py: 2.5,
              borderRadius: 2,
              border: `1px dashed ${tokens.border}`,
              bgcolor: 'rgba(0,0,0,0.18)',
              color: tokens.muted,
            }}
          >
            <LockIcon sx={{ fontSize: 28, color: tokens.goldDim }} />
            <Box
              sx={{
                width: '70%',
                height: 8,
                borderRadius: 4,
                background: tokens.surface3,
                filter: 'blur(1.5px)',
              }}
            />
            <Typography variant="caption" sx={{ fontStyle: 'italic', letterSpacing: '0.04em' }}>
              {t('common.locked')}
            </Typography>
          </Stack>
          {footer}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ width: 300 }} data-testid="doc-open">
      <CardActionArea onClick={() => onOpen(doc.id)} sx={{ height: '100%' }}>
        <CardContent>
          {header}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <DescriptionOutlinedIcon sx={{ color: tokens.gold, fontSize: 20, mt: 0.25 }} />
            <Typography variant="subtitle1" sx={{ color: tokens.text }}>
              {title}
            </Typography>
          </Stack>
          {footer}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export function DocumentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [ordering, setOrdering] = useState('')

  // Form/dialog state: editId === undefined => closed; null => create; number => edit.
  const [editId, setEditId] = useState<number | null | undefined>(undefined)
  const [editInitial, setEditInitial] = useState<DocumentWrite | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<DocumentListItem | null>(null)

  // Debounce the search box before it drives the query param `q`.
  useEffect(() => {
    const handle = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(handle)
  }, [search])

  const listParams = useMemo(() => ({ q, ordering }), [q, ordering])
  const { data, isLoading } = useQuery({
    queryKey: ['documents', listParams],
    queryFn: () => fetchDocuments(listParams),
  })

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['documents'] })

  const createMut = useMutation({
    mutationFn: (body: DocumentWrite) => createDocument(body),
    onSuccess: () => {
      void invalidateList()
      setEditId(undefined)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: DocumentWrite }) => updateDocument(id, body),
    onSuccess: () => {
      void invalidateList()
      setEditId(undefined)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => removeDocument(id),
    onSuccess: () => {
      void invalidateList()
      setPendingDelete(null)
    },
  })

  const openCreate = () => {
    setEditInitial(undefined)
    setEditId(null)
  }

  const openEdit = (doc: DocumentDetail) => {
    setEditInitial({
      title_ar: doc.title_ar,
      title_en: doc.title_en,
      body: doc.body,
      classification: doc.classification,
    })
    setEditId(doc.id)
    setSelected(null)
  }

  // Edit from a list card: fetch the full record, then open the form.
  const openEditFromList = async (id: number) => {
    const doc = await queryClient.fetchQuery({
      queryKey: ['document', id],
      queryFn: () => fetchDocument(id),
    })
    openEdit(doc)
  }

  const submitForm = (value: DocumentWrite) => {
    if (typeof editId === 'number') updateMut.mutate({ id: editId, body: value })
    else createMut.mutate(value)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const docs = data ?? []
  const locked = docs.filter((d) => d.locked).length
  const accessible = docs.length - locked

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.documents')}</Typography>
        <Chip size="small" label={docs.length} sx={{ color: tokens.gold }} variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          data-testid="doc-new"
        >
          {t('common.new')}
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard label={t('nav.documents')} value={docs.length} icon={<FolderOpenIcon />} />
        <StatCard
          label={t('documents.access')}
          value={accessible}
          accent={tokens.green}
          icon={<DescriptionOutlinedIcon />}
        />
        <StatCard
          label={t('common.locked')}
          value={locked}
          accent={tokens.red}
          icon={<LockIcon />}
        />
      </Stack>

      <SectionCard
        title={t('nav.documents')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'doc-search' }}
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="doc-ordering-label">{t('common.actions')}</InputLabel>
              <Select
                labelId="doc-ordering-label"
                label={t('common.actions')}
                value={ordering}
                onChange={(e) => setOrdering(e.target.value)}
                data-testid="doc-ordering"
                displayEmpty
              >
                <MenuItem value="">—</MenuItem>
                {ORDERING_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {t(o.labelKey, o.fallback)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        }
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {docs.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              onOpen={setSelected}
              onEdit={(id) => void openEditFromList(id)}
              onDelete={setPendingDelete}
            />
          ))}
        </Box>
      </SectionCard>

      {selected !== null && (
        <DetailDialog id={selected} onClose={() => setSelected(null)} onEdit={openEdit} />
      )}

      <DocumentForm
        open={editId !== undefined}
        initial={editInitial}
        title={typeof editId === 'number' ? t('common.edit') : t('common.new')}
        saving={createMut.isPending || updateMut.isPending}
        onClose={() => setEditId(undefined)}
        onSubmit={submitForm}
      />

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{t('common.delete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('common.confirmDelete')}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingDelete(null)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMut.isPending}
            onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
            data-testid="doc-delete-confirm"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
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
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  deleteAttachment,
  downloadUrl,
  fetchAttachments,
  uploadAttachment,
  type Attachment,
  type AttachmentKind,
} from '../../api/attachments'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

const KIND_COLOR: Record<AttachmentKind, string> = {
  document: tokens.green,
  spreadsheet: tokens.cyan,
  image: tokens.gold,
  invoice: tokens.orange,
  other: tokens.muted,
}

function humanizeBytes(bytes: number, ar: boolean): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exp
  const text = exp === 0 ? String(bytes) : value.toFixed(1)
  return `${Number(text).toLocaleString(ar ? 'ar' : 'en')} ${units[exp]}`
}

function formatDate(iso: string, ar: boolean): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(ar ? 'ar' : 'en')
}

export function FilesPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [classificationLevel, setClassificationLevel] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [deleting, setDeleting] = useState<Attachment | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['attachments'],
    queryFn: () => fetchAttachments(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attachments'] })

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await uploadAttachment({ file, classification: classificationLevel })
      }
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    uploadMutation.mutate(Array.from(list))
  }

  const files = useMemo<Attachment[]>(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return files
    return files.filter((f) => f.original_name.toLowerCase().includes(needle))
  }, [files, search])

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const documentsCount = files.filter((f) => f.kind === 'document').length
  const spreadsheetsCount = files.filter((f) => f.kind === 'spreadsheet').length

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('files.title', 'Files')}</Typography>
        <Chip size="small" label={files.length} variant="outlined" data-testid="files-count" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('files.total', 'Total files')}
            value={files.length}
            accent={tokens.gold}
            icon={<FolderOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('files.totalSize', 'Total size')}
            value={humanizeBytes(totalSize, ar)}
            accent={tokens.cyan}
            icon={<StorageOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('files.documents', 'Documents')}
            value={documentsCount}
            accent={tokens.green}
            icon={<DescriptionOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('files.spreadsheets', 'Spreadsheets')}
            value={spreadsheetsCount}
            accent={tokens.orange}
            icon={<TableChartOutlinedIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('files.upload', 'Upload')}>
        <Stack spacing={2}>
          <Box
            data-testid="files-dropzone"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFiles(e.dataTransfer.files)
            }}
            sx={{
              border: `1.5px dashed ${dragOver ? tokens.gold : tokens.border}`,
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: dragOver ? 'rgba(201,162,39,0.06)' : tokens.surface2,
              transition: 'border-color 120ms, background-color 120ms',
            }}
          >
            <UploadFileIcon sx={{ fontSize: 40, color: tokens.gold, mb: 1 }} />
            <Typography sx={{ color: tokens.text, mb: 0.5 }}>
              {t('files.dropHere', 'Drag & drop files here')}
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.muted, mb: 2 }}>
              {t('files.dropHint', 'or select files from your device')}
            </Typography>

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="center"
              flexWrap="wrap"
              useFlexGap
            >
              <TextField
                select
                size="small"
                label={t('files.classification', 'Classification')}
                value={classificationLevel}
                onChange={(e) => setClassificationLevel(Number(e.target.value))}
                slotProps={{ select: { native: true } }}
                inputProps={{ 'data-testid': 'files-classification' }}
                sx={{ minWidth: 180 }}
              >
                {CLEARANCES.map((n) => (
                  <option key={n} value={n}>
                    {t(`clearance.${n}`)}
                  </option>
                ))}
              </TextField>

              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => inputRef.current?.click()}
                disabled={uploadMutation.isPending}
                data-testid="files-upload-btn"
              >
                {t('files.select', 'Select files')}
              </Button>
            </Stack>

            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              data-testid="files-input"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </Box>

          {uploadMutation.isPending && (
            <Box>
              <LinearProgress />
              <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
                {t('files.uploading', 'Uploading…')}
              </Typography>
            </Box>
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title={t('files.library', 'File library')}
        action={
          <TextField
            size="small"
            placeholder={t('files.search', 'Search files')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'data-testid': 'files-search' }}
          />
        }
      >
        {filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <FolderOutlinedIcon sx={{ fontSize: 44, color: tokens.muted, mb: 1 }} />
            <Typography sx={{ color: tokens.muted }}>
              {t('files.empty', 'No files found')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table data-testid="files-table">
              <TableHead>
                <TableRow>
                  <TableCell>{t('files.name', 'Name')}</TableCell>
                  <TableCell>{t('files.classification', 'Classification')}</TableCell>
                  <TableCell>{t('files.size', 'Size')}</TableCell>
                  <TableCell>{t('files.owner', 'Owner')}</TableCell>
                  <TableCell>{t('files.created', 'Created')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id} data-testid="file-row">
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ color: tokens.text }}>{f.original_name}</Typography>
                        <Chip
                          size="small"
                          label={t(`files.kind.${f.kind}`, f.kind)}
                          variant="outlined"
                          sx={{
                            color: KIND_COLOR[f.kind],
                            borderColor: KIND_COLOR[f.kind],
                            fontWeight: 600,
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge level={f.classification} />
                    </TableCell>
                    <TableCell>{humanizeBytes(f.size, ar)}</TableCell>
                    <TableCell>{f.owner ?? '—'}</TableCell>
                    <TableCell>{formatDate(f.created_at, ar)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        component="a"
                        href={downloadUrl(f.id)}
                        download
                        aria-label={t('files.download', 'Download')}
                        data-testid="file-download"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={t('common.delete')}
                        data-testid="file-delete"
                        onClick={() => setDeleting(f)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs">
        <DialogTitle>{t('files.deleteTitle', 'Delete file')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t(
              'files.deleteBody',
              'Are you sure you want to delete this file? This action is audited.',
            )}
          </Typography>
          {deleting && (
            <Typography sx={{ color: tokens.muted, mt: 1 }}>{deleting.original_name}</Typography>
          )}
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

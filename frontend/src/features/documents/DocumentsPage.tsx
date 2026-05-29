import LockIcon from '@mui/icons-material/Lock'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchDocument, fetchDocuments, type DocumentListItem } from '../../api/documents'
import { ClassificationBadge } from '../../components/ClassificationBadge'

function DetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Opening a document hits the IDOR-safe detail endpoint, which access-logs the read.
  const { data, isLoading } = useQuery({ queryKey: ['document', id], queryFn: () => fetchDocument(id) })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isLoading || !data ? t('common.loading') : ar ? data.title_ar : data.title_en}
      </DialogTitle>
      <DialogContent>
        {isLoading || !data ? (
          <CircularProgress />
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ClassificationBadge level={data.classification} />
              <Chip size="small" label={`v${data.version}`} />
              <Chip size="small" variant="outlined" label={`${t('documents.access')}: ${data.access_count}`} />
              {data.owner && <Chip size="small" variant="outlined" label={`${t('documents.owner')}: ${data.owner}`} />}
            </Stack>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.body}</Typography>
            <Divider />
            <Typography variant="subtitle2">{t('documents.versionHistory')}</Typography>
            <Stack spacing={0.5}>
              {data.versions.map((v) => (
                <Stack key={v.number} direction="row" spacing={2} sx={{ fontSize: 13 }}>
                  <Box component="span" sx={{ width: 40 }}>v{v.number}</Box>
                  <Box component="span" sx={{ flex: 1 }}>{ar ? v.note_ar : v.note_en}</Box>
                  <Box component="span" sx={{ opacity: 0.6 }}>{v.created_at.slice(0, 10)}</Box>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DocCard({ doc, onOpen }: { doc: DocumentListItem; onOpen: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? doc.title_ar : doc.title_en

  const inner = (
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <ClassificationBadge level={doc.classification} />
        <Chip size="small" label={`v${doc.version}`} />
      </Stack>
      {doc.locked ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
          <LockIcon fontSize="small" />
          <Typography sx={{ filter: 'blur(0.5px)', fontStyle: 'italic' }}>
            {t('common.locked')}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="subtitle1">{title}</Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('documents.access')}: {doc.access_count}
      </Typography>
    </CardContent>
  )

  return (
    <Card sx={{ width: 300 }} data-testid={doc.locked ? 'doc-locked' : 'doc-open'}>
      {doc.locked ? inner : <CardActionArea onClick={() => onOpen(doc.id)}>{inner}</CardActionArea>}
    </Card>
  )
}

export function DocumentsPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const docs = data ?? []
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.documents')}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {docs.map((d) => (
          <DocCard key={d.id} doc={d} onOpen={setSelected} />
        ))}
      </Box>
      {selected !== null && <DetailDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}

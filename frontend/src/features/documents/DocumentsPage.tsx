import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LockIcon from '@mui/icons-material/Lock'
import VisibilityIcon from '@mui/icons-material/Visibility'
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
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

function DetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Opening a document hits the IDOR-safe detail endpoint, which access-logs the read.
  const { data, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id),
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
    </Dialog>
  )
}

function DocCard({ doc, onOpen }: { doc: DocumentListItem; onOpen: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? doc.title_ar : doc.title_en

  const header = (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ mb: 1.5 }}
    >
      <ClassificationBadge level={doc.classification} />
      <Chip size="small" label={`v${doc.version}`} sx={{ fontWeight: 700 }} />
    </Stack>
  )

  const footer = (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{ mt: 1.5, color: tokens.muted }}
    >
      <VisibilityIcon sx={{ fontSize: 15 }} />
      <Typography variant="caption">
        {t('documents.access')}: {doc.access_count}
      </Typography>
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
  const locked = docs.filter((d) => d.locked).length
  const accessible = docs.length - locked

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.documents')}</Typography>
        <Chip size="small" label={docs.length} sx={{ color: tokens.gold }} variant="outlined" />
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('nav.documents')}
          value={docs.length}
          icon={<FolderOpenIcon />}
        />
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

      <SectionCard title={t('nav.documents')}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} onOpen={setSelected} />
          ))}
        </Box>
      </SectionCard>

      {selected !== null && <DetailDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}

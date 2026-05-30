import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
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
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchDocuments, type DocumentListItem } from '../../api/documents'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

type SortField = 'title' | 'classification' | 'version' | 'updated_at' | 'access_count'

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// Resolve the row's displayable title for the active language, or null when the
// server withheld it (locked documents arrive with title_ar/title_en === null).
function rowTitle(doc: DocumentListItem, ar: boolean): string | null {
  return ar ? doc.title_ar : doc.title_en
}

export function ArchivePage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading } = useQuery({
    queryKey: ['archive', q] as const,
    queryFn: () => fetchDocuments(q ? { q } : {}),
  })

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'updated_at' ? 'desc' : 'asc')
    }
  }

  const docs: DocumentListItem[] = useMemo(() => data ?? [], [data])

  // Client-side ordering for this read-only register.
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const rows = [...docs]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title': {
          const ta = rowTitle(a, ar) ?? ''
          const tb = rowTitle(b, ar) ?? ''
          cmp = ta.localeCompare(tb)
          break
        }
        case 'updated_at':
          cmp = a.updated_at.localeCompare(b.updated_at)
          break
        default:
          cmp = a[sortField] - b[sortField]
          break
      }
      return cmp * dir
    })
    return rows
  }, [docs, sortField, sortDir, ar])

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(ar ? 'ar' : 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [ar],
  )

  const sortHeader = (field: SortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDir : 'asc'}
      onClick={() => handleSort(field)}
      IconComponent={sortField === field && sortDir === 'desc' ? ArrowDownwardIcon : ArrowUpwardIcon}
    >
      {label}
    </TableSortLabel>
  )

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.archive')}</Typography>
        <Chip size="small" label={docs.length} variant="outlined" />
      </Stack>

      <SectionCard
        title={t('archive.register', 'Archival register')}
        action={
          <TextField
            size="small"
            placeholder={t('common.searchHere', 'Search…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'data-testid': 'archive-search' }}
          />
        }
      >
        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table data-testid="archive-table">
              <TableHead>
                <TableRow>
                  <TableCell>{sortHeader('title', t('archive.title', 'Title'))}</TableCell>
                  <TableCell>
                    {sortHeader('classification', t('archive.classification', 'Classification'))}
                  </TableCell>
                  <TableCell>{sortHeader('version', t('archive.version', 'Version'))}</TableCell>
                  <TableCell>
                    {sortHeader('updated_at', t('archive.updated', 'Last updated'))}
                  </TableCell>
                  <TableCell align="right">
                    {sortHeader('access_count', t('archive.access', 'Accesses'))}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((doc) => {
                  const title = rowTitle(doc, ar)
                  return (
                    <TableRow key={doc.id} data-testid="archive-row">
                      <TableCell>
                        {doc.locked ? (
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ color: tokens.muted }}
                            data-testid="archive-locked"
                          >
                            <LockOutlinedIcon fontSize="small" />
                            <Typography component="span">—</Typography>
                          </Stack>
                        ) : (
                          <Typography component="span" sx={{ color: tokens.text }}>
                            {title ?? '—'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <ClassificationBadge level={doc.classification} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={`v${doc.version}`} />
                      </TableCell>
                      <TableCell>{dateFmt.format(new Date(doc.updated_at))}</TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="flex-end"
                          spacing={0.5}
                          sx={{ color: tokens.muted }}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                          <Typography component="span">{doc.access_count}</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Stack>
  )
}

import DrawIcon from '@mui/icons-material/Draw'
import VerifiedIcon from '@mui/icons-material/Verified'
import {
  Box,
  Button,
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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchDocuments, type DocumentListItem } from '../../api/documents'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.signatures'

// A persisted signature record keyed by document id in localStorage.
interface SignatureRecord {
  hash: string
  signer: string
  signedAt: string
}

type SignatureMap = Record<string, SignatureRecord>

function loadSignatures(): SignatureMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as SignatureMap
    return {}
  } catch {
    return {}
  }
}

function saveSignatures(map: SignatureMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Non-fatal: persistence is best-effort (e.g. private mode quota).
  }
}

// 32-byte cryptographically-random hex digest standing in for a real signature.
function generateHash(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function SignaturesPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'

  const [signatures, setSignatures] = useState<SignatureMap>(() => loadSignatures())

  const { data, isLoading } = useQuery({
    queryKey: ['signatures', 'documents'],
    queryFn: () => fetchDocuments(),
  })

  const handleSign = useCallback((doc: DocumentListItem) => {
    const record: SignatureRecord = {
      hash: generateHash(),
      signer: t('signatures.signer', 'Authorized Officer'),
      signedAt: new Date().toISOString(),
    }
    setSignatures((prev) => {
      const next: SignatureMap = { ...prev, [String(doc.id)]: record }
      saveSignatures(next)
      return next
    })
  }, [t])

  const documents: DocumentListItem[] = useMemo(() => data ?? [], [data])
  const signedCount = documents.filter((d) => signatures[String(d.id)]).length

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
        <Typography variant="h5">{t('nav.signatures', 'Digital Signatures')}</Typography>
        <Chip size="small" label={`${signedCount}/${documents.length}`} variant="outlined" />
      </Stack>

      <SectionCard title={t('signatures.title', 'Document Signing')}>
        <TableContainer>
          <Table data-testid="signatures-table">
            <TableHead>
              <TableRow>
                <TableCell>{t('signatures.document', 'Document')}</TableCell>
                <TableCell>{t('signatures.classification', 'Classification')}</TableCell>
                <TableCell>{t('signatures.status', 'Status')}</TableCell>
                <TableCell align="right">{t('signatures.action', 'Action')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => {
                const record = signatures[String(doc.id)]
                const title =
                  (ar ? doc.title_ar : doc.title_en) ??
                  doc.title_en ??
                  doc.title_ar ??
                  `#${doc.id}`
                return (
                  <TableRow key={doc.id} data-testid="signature-row">
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>{title}</Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`v${doc.version}`}
                          sx={{ color: tokens.muted, borderColor: tokens.border }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge level={doc.classification} />
                    </TableCell>
                    <TableCell>
                      {record ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            icon={<VerifiedIcon />}
                            label={t('signatures.signed', 'Signed')}
                            sx={{
                              color: tokens.gold,
                              borderColor: tokens.borderGold,
                              bgcolor: 'transparent',
                            }}
                            variant="outlined"
                            data-testid="signed-chip"
                          />
                          <Typography
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: tokens.muted,
                            }}
                            title={record.hash}
                          >
                            {record.hash.slice(0, 12)}…
                          </Typography>
                        </Stack>
                      ) : (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('signatures.pending', 'Pending')}
                          sx={{ color: tokens.muted, borderColor: tokens.border }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {doc.locked ? (
                        <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
                          {t('signatures.locked', 'Locked')}
                        </Typography>
                      ) : record ? (
                        <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
                          {t('signatures.signer', 'Authorized Officer')}
                        </Typography>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DrawIcon />}
                          onClick={() => handleSign(doc)}
                          data-testid="sign-button"
                        >
                          {t('signatures.sign', 'Sign')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </Stack>
  )
}

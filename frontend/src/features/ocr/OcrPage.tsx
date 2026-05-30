import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined'
import HistoryIcon from '@mui/icons-material/History'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.ocr'

interface OcrFields {
  documentNo: string
  date: string
  classification: 1 | 2 | 3 | 4
  subject: string
}

interface OcrRecord {
  id: string
  filename: string
  processedAt: string
  fields: OcrFields
  text: string
}

// Deterministic 32-bit hash of the filename so the same file always yields the
// same mock extraction (no randomness here — this is a reproducible demo).
function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Derive a stable mock document date from the hash (kept in the past, no clock).
function derivedDate(hash: number): string {
  const year = 2024 + (hash % 2)
  const month = (hash % 12) + 1
  const day = (hash % 27) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

function deriveFields(filename: string): OcrFields {
  const hash = hashString(filename)
  const base = filename.replace(/\.[^.]+$/, '').slice(0, 48) || 'Document'
  return {
    documentNo: `DOC-${String(hash % 100000).padStart(5, '0')}`,
    date: derivedDate(hash),
    classification: ((hash % 4) + 1) as 1 | 2 | 3 | 4,
    subject: base,
  }
}

function buildMockText(filename: string, fields: OcrFields): string {
  return [
    `Document No: ${fields.documentNo}`,
    `Date: ${fields.date}`,
    `Subject: ${fields.subject}`,
    '',
    `This is simulated text extracted from "${filename}". The on-prem OCR engine`,
    'would return the recognized body content here, preserving paragraphs and',
    'tabular layout where detected. The figures, references and signatures below',
    'are placeholders generated deterministically from the file name for this demo.',
    '',
    `Reference: ${fields.documentNo} / ${fields.date}`,
    'Prepared by: Records & Archiving Unit',
    'Status: Pending review',
  ].join('\n')
}

function loadHistory(): OcrRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OcrRecord[]) : []
  } catch {
    return []
  }
}

export function OcrPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [filename, setFilename] = useState<string>('')
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fields, setFields] = useState<OcrFields | null>(null)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<OcrRecord[]>(() => loadHistory())

  // Simulated progress ticker while "extracting".
  useEffect(() => {
    if (!extracting) return
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(id)
          return 100
        }
        return Math.min(100, p + 12)
      })
    }, 140)
    return () => window.clearInterval(id)
  }, [extracting])

  // When progress completes, render the mock result and persist it.
  useEffect(() => {
    if (!extracting || progress < 100 || !filename) return
    const derived = deriveFields(filename)
    const body = buildMockText(filename, derived)
    setFields(derived)
    setText(body)
    setExtracting(false)

    const record: OcrRecord = {
      id: crypto.randomUUID(),
      filename,
      processedAt: new Date().toISOString(),
      fields: derived,
      text: body,
    }
    setHistory((prev) => {
      const next = [record, ...prev].slice(0, 12)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage may be unavailable; demo can continue without persistence */
      }
      return next
    })
  }, [extracting, progress, filename])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setFields(null)
    setText('')
    setCopied(false)
    setProgress(0)
    setExtracting(true)
    // allow re-selecting the same file later
    e.target.value = ''
  }

  const handleCopy = () => {
    if (!text) return
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const formatTime = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(ar ? 'ar' : 'en')
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.ocr', 'OCR Center')}</Typography>
        <Chip size="small" label={history.length} variant="outlined" />
      </Stack>

      <Alert severity="info" icon={<InfoOutlinedIcon />}>
        {t(
          'ocr.demoNotice',
          'Demo only — no document leaves the browser and no real OCR runs. Production wires a real on-prem OCR engine.',
        )}
      </Alert>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('ocr.processed', 'Processed files')}
            value={history.length}
            accent={tokens.gold}
            icon={<DocumentScannerOutlinedIcon />}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('ocr.lastDocument', 'Last document')}
            value={fields?.documentNo ?? '—'}
            accent={tokens.cyan}
            icon={<DescriptionOutlinedIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('ocr.extract', 'Extract document text')}
        action={
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={extracting}
            data-testid="ocr-upload"
          >
            {t('ocr.selectFile', 'Select file')}
          </Button>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={handleFile}
          data-testid="ocr-input"
        />

        {!filename && (
          <Typography sx={{ color: tokens.muted }}>
            {t('ocr.empty', 'Select an image or PDF to simulate text extraction.')}
          </Typography>
        )}

        {filename && (
          <Stack spacing={1.5}>
            <Typography sx={{ color: tokens.text }}>
              <Box component="span" sx={{ color: tokens.muted, me: 1 }}>
                {t('ocr.file', 'File')}:
              </Box>{' '}
              {filename}
            </Typography>

            {extracting && (
              <Box>
                <Typography sx={{ color: tokens.gold, mb: 0.75, fontSize: 13 }}>
                  {t('ocr.extracting', 'Extracting…')} {progress}%
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}
          </Stack>
        )}
      </SectionCard>

      {fields && !extracting && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <SectionCard
            title={t('ocr.fields', 'Detected fields')}
            sx={{ flex: 1, minWidth: 280 }}
          >
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: tokens.muted }}>
                      {t('ocr.documentNo', 'Document No')}
                    </TableCell>
                    <TableCell>{fields.documentNo}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: tokens.muted }}>
                      {t('ocr.date', 'Date')}
                    </TableCell>
                    <TableCell>{fields.date}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: tokens.muted }}>
                      {t('ocr.classification', 'Classification')}
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge level={fields.classification} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: tokens.muted, border: 0 }}>
                      {t('ocr.subject', 'Subject')}
                    </TableCell>
                    <TableCell sx={{ border: 0 }}>{fields.subject}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>

          <SectionCard
            title={t('ocr.extractedText', 'Extracted text')}
            sx={{ flex: 2, minWidth: 320 }}
            action={
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopy}
                data-testid="ocr-copy"
              >
                {copied ? t('ocr.copied', 'Copied') : t('ocr.copyText', 'Copy text')}
              </Button>
            }
          >
            <Box
              component="pre"
              dir="ltr"
              sx={{
                m: 0,
                p: 2,
                borderRadius: 1,
                bgcolor: tokens.surface2,
                border: `1px solid ${tokens.border}`,
                color: tokens.text,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 360,
                overflow: 'auto',
              }}
              data-testid="ocr-text"
            >
              {text}
            </Box>
          </SectionCard>
        </Box>
      )}

      <SectionCard
        title={t('ocr.history', 'Previously processed')}
        action={<HistoryIcon sx={{ color: tokens.muted }} />}
      >
        {history.length === 0 ? (
          <Typography sx={{ color: tokens.muted }}>
            {t('ocr.noHistory', 'No files processed yet.')}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" data-testid="ocr-history">
              <TableBody>
                {history.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell sx={{ color: tokens.text }}>{rec.filename}</TableCell>
                    <TableCell sx={{ color: tokens.muted, whiteSpace: 'nowrap' }}>
                      {rec.fields.documentNo}
                    </TableCell>
                    <TableCell>
                      <ClassificationBadge level={rec.fields.classification} />
                    </TableCell>
                    <TableCell sx={{ color: tokens.muted, whiteSpace: 'nowrap' }}>
                      {formatTime(rec.processedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Stack>
  )
}

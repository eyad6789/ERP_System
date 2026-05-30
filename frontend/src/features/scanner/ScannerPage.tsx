import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import PaymentsIcon from '@mui/icons-material/Payments'
import SaveIcon from '@mui/icons-material/Save'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Tesseract from 'tesseract.js'

import { uploadAttachment } from '../../api/attachments'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCE_LEVELS = [1, 2, 3, 4] as const

interface LineItem {
  description: string
  qty: string
  price: string
}

interface InvoiceFields {
  invoiceNumber: string
  date: string
  vendor: string
  currency: string
  subtotal: string
  tax: string
  total: string
  lineItems: LineItem[]
}

const EMPTY_FIELDS: InvoiceFields = {
  invoiceNumber: '',
  date: '',
  vendor: '',
  currency: '',
  subtotal: '',
  tax: '',
  total: '',
  lineItems: [],
}

// Parse a localized/Latin numeric token into a float, stripping thousands separators.
function toNumber(raw: string): number {
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const value = Number.parseFloat(normalized)
  return Number.isNaN(value) ? NaN : value
}

// Pure, testable invoice extractor: regex over raw OCR text into editable fields.
function extractInvoiceFields(text: string): InvoiceFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const fields: InvoiceFields = { ...EMPTY_FIELDS, lineItems: [] }

  const invoiceMatch = text.match(
    /(invoice|inv|فاتورة)\s*#?\s*[:-]?\s*([A-Z0-9/-]{3,})/i,
  )
  if (invoiceMatch) fields.invoiceNumber = invoiceMatch[2]!.trim()

  const isoDate = text.match(/(\d{4}-\d{2}-\d{2})/)
  const looseDate = text.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/)
  if (isoDate) fields.date = isoDate[1]!
  else if (looseDate) fields.date = looseDate[1]!

  // Vendor: a labelled line wins; otherwise the first meaningful line.
  const vendorLabelIdx = lines.findIndex((l) =>
    /(from|vendor|supplier|bill from)/i.test(l),
  )
  if (vendorLabelIdx !== -1) {
    const labelLine = lines[vendorLabelIdx]!
    const afterLabel = labelLine
      .replace(/.*(from|vendor|supplier|bill from)\s*[:-]?\s*/i, '')
      .trim()
    fields.vendor = afterLabel || lines[vendorLabelIdx + 1]?.trim() || ''
  }
  if (!fields.vendor) fields.vendor = lines[0] ?? ''

  if (/\bIQD\b|د\.ع/.test(text)) fields.currency = 'IQD'
  else if (/\bUSD\b|\$/.test(text)) fields.currency = 'USD'
  else if (/\bEUR\b|€/.test(text)) fields.currency = 'EUR'

  // Amount lines: capture every "<label> <number>" so we can pick total/tax/subtotal.
  const amountRe = /([A-Za-z؀-ۿ ]+?)[\s:.-]*([\d.,]+\d)\s*([A-Za-z$€]{1,4})?\s*$/
  const totals: number[] = []
  for (const line of lines) {
    const m = line.match(amountRe)
    if (!m) continue
    const label = m[1]!.toLowerCase()
    const value = toNumber(m[2]!)
    if (Number.isNaN(value)) continue
    // Order matters: "subtotal" and "grand total" both contain "total".
    if (/(subtotal|sub total)/i.test(label)) {
      fields.subtotal = m[2]!
    } else if (/(vat|tax|الضريبة)/i.test(label)) {
      fields.tax = m[2]!
    } else if (/(grand total|amount due|total|المجموع)/i.test(label)) {
      totals.push(value)
    }
  }
  if (totals.length > 0) {
    const max = Math.max(...totals)
    fields.total = String(max)
  }

  // Simple line items: "<description> .... <qty> <price>".
  const itemRe = /^(.+?)\s+(\d+)\s+([\d.,]+\d)$/
  for (const line of lines) {
    if (/(total|subtotal|vat|tax|المجموع|الضريبة)/i.test(line)) continue
    const m = line.match(itemRe)
    if (m) {
      fields.lineItems.push({
        description: m[1]!.trim(),
        qty: m[2]!,
        price: m[3]!,
      })
    }
  }

  return fields
}

export function ScannerPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string>('')
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState<InvoiceFields>(EMPTY_FIELDS)
  const [classification, setClassification] = useState(2)
  const [scannedCount, setScannedCount] = useState(0)
  const [lastTotal, setLastTotal] = useState<string>('—')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const setField = <K extends keyof InvoiceFields>(key: K, value: InvoiceFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }))

  // REAL on-device OCR — the file never leaves the browser.
  const runOcr = async (chosen: File) => {
    setError('')
    setProgress(0)
    setRunning(true)
    try {
      const { data } = await Tesseract.recognize(chosen, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })
      const text = data.text ?? ''
      setRawText(text)
      const extracted = extractInvoiceFields(text)
      setFields(extracted)
      setScannedCount((c) => c + 1)
      if (extracted.total) {
        setLastTotal(
          extracted.currency ? `${extracted.total} ${extracted.currency}` : extracted.total,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  const acceptFile = (chosen: File | undefined | null) => {
    if (!chosen) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(chosen)
    setPreviewUrl(URL.createObjectURL(chosen))
    setRawText('')
    setFields(EMPTY_FIELDS)
    void runOcr(chosen)
  }

  const saveMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file')
      return uploadAttachment({
        file,
        classification,
        kind: 'invoice',
        extracted: { fields, text: rawText },
      })
    },
    onSuccess: () => {
      setSaved(true)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err))
    },
  })

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
    } catch {
      setCopied(true)
    }
  }

  const fieldDefs = useMemo(
    () =>
      [
        { name: 'invoiceNumber', labelKey: 'scanner.invoiceNumber', fallback: 'Invoice number' },
        { name: 'date', labelKey: 'scanner.date', fallback: 'Date' },
        { name: 'vendor', labelKey: 'scanner.vendor', fallback: 'Vendor' },
        { name: 'currency', labelKey: 'scanner.currency', fallback: 'Currency' },
        { name: 'subtotal', labelKey: 'scanner.subtotal', fallback: 'Subtotal' },
        { name: 'tax', labelKey: 'scanner.tax', fallback: 'Tax (VAT)' },
        { name: 'total', labelKey: 'scanner.total', fallback: 'Total' },
      ] as const,
    [],
  )

  return (
    <Stack spacing={3} dir={ar ? 'rtl' : 'ltr'}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <DocumentScannerIcon sx={{ color: tokens.gold }} />
        <Typography variant="h5">{t('scanner.title', 'AI Invoice Scanner')}</Typography>
        <Chip
          size="small"
          label={t('scanner.onDevice', 'On-device')}
          sx={{ color: tokens.green, borderColor: tokens.green }}
          variant="outlined"
        />
      </Stack>

      <Alert severity="info" data-testid="scanner-privacy">
        {t(
          'scanner.privacy',
          'OCR runs locally in your browser via an on-device engine; no image or data is uploaded until you explicitly save.',
        )}
      </Alert>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('scanner.scannedSession', 'Scanned this session')}
          value={scannedCount}
          icon={<DocumentScannerIcon />}
        />
        <StatCard
          label={t('scanner.lastTotal', 'Last total detected')}
          value={lastTotal}
          accent={tokens.green}
          icon={<PaymentsIcon />}
        />
      </Stack>

      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="stretch">
        <SectionCard title={t('scanner.upload', 'Upload invoice')} sx={{ flex: 1, minWidth: 360 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            data-testid="scanner-input"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
          <Box
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              acceptFile(e.dataTransfer.files?.[0])
            }}
            data-testid="scanner-dropzone"
            sx={{
              cursor: 'pointer',
              borderRadius: 2,
              border: `1px dashed ${dragOver ? tokens.gold : tokens.border}`,
              bgcolor: dragOver ? 'rgba(201,162,39,0.06)' : 'rgba(0,0,0,0.18)',
              p: 3,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              transition: 'border-color 120ms, background-color 120ms',
            }}
          >
            <UploadFileIcon sx={{ fontSize: 34, color: tokens.gold, mb: 1 }} />
            <Typography variant="body2" sx={{ color: tokens.text }}>
              {t('scanner.dropHint', 'Click to choose or drag an image here')}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {t('scanner.accept', 'PNG, JPG — image files only')}
            </Typography>
          </Box>

          {previewUrl && (
            <Box
              component="img"
              src={previewUrl}
              alt={t('scanner.preview', 'Invoice preview')}
              data-testid="scanner-preview"
              sx={{
                mt: 2,
                width: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                borderRadius: 2,
                border: `1px solid ${tokens.border}`,
              }}
            />
          )}

          {running && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: tokens.muted }}>
                  {t('scanner.recognizing', 'Recognizing text…')}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.gold }}>
                  {progress}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress}
                data-testid="scanner-progress"
              />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} data-testid="scanner-error">
              {error}
            </Alert>
          )}
        </SectionCard>

        <SectionCard
          title={t('scanner.fields', 'Extracted fields')}
          sx={{ flex: 1, minWidth: 360 }}
          action={
            <Stack direction="row" spacing={1.25} alignItems="center">
              <ClassificationBadge level={classification} />
              <Box
                component="select"
                value={classification}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setClassification(Number(e.target.value))
                }
                data-testid="scanner-classification"
                aria-label={t('personnel.clearance', 'Clearance')}
                sx={{
                  bgcolor: tokens.surface3,
                  color: tokens.text,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 1,
                  px: 1,
                  py: 0.75,
                  fontSize: 13,
                }}
              >
                {CLEARANCE_LEVELS.map((n) => (
                  <option key={n} value={n}>
                    {t(`clearance.${n}`)}
                  </option>
                ))}
              </Box>
            </Stack>
          }
        >
          <Stack spacing={2}>
            {fieldDefs.map((def) => (
              <TextField
                key={def.name}
                size="small"
                fullWidth
                label={t(def.labelKey, def.fallback)}
                value={fields[def.name] as string}
                onChange={(e) => setField(def.name, e.target.value)}
                inputProps={{ 'data-testid': `field-${def.name}` }}
              />
            ))}

            {fields.lineItems.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ color: tokens.muted }}>
                  {t('scanner.lineItems', 'Line items')}
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {fields.lineItems.map((item, idx) => (
                    <Stack
                      key={idx}
                      direction="row"
                      spacing={1}
                      data-testid={`line-item-${idx}`}
                    >
                      <TextField
                        size="small"
                        sx={{ flex: 2 }}
                        label={t('scanner.itemDescription', 'Description')}
                        value={item.description}
                        onChange={(e) =>
                          setField(
                            'lineItems',
                            fields.lineItems.map((it, i) =>
                              i === idx ? { ...it, description: e.target.value } : it,
                            ),
                          )
                        }
                        inputProps={{ 'data-testid': `line-item-desc-${idx}` }}
                      />
                      <TextField
                        size="small"
                        sx={{ width: 80 }}
                        label={t('scanner.itemQty', 'Qty')}
                        value={item.qty}
                        onChange={(e) =>
                          setField(
                            'lineItems',
                            fields.lineItems.map((it, i) =>
                              i === idx ? { ...it, qty: e.target.value } : it,
                            ),
                          )
                        }
                        inputProps={{ 'data-testid': `line-item-qty-${idx}` }}
                      />
                      <TextField
                        size="small"
                        sx={{ width: 110 }}
                        label={t('scanner.itemPrice', 'Price')}
                        value={item.price}
                        onChange={(e) =>
                          setField(
                            'lineItems',
                            fields.lineItems.map((it, i) =>
                              i === idx ? { ...it, price: e.target.value } : it,
                            ),
                          )
                        }
                        inputProps={{ 'data-testid': `line-item-price-${idx}` }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!file || running || saveMut.isPending}
              onClick={() => saveMut.mutate()}
              data-testid="scanner-save"
            >
              {t('scanner.save', 'Save to Files')}
            </Button>
          </Stack>
        </SectionCard>
      </Stack>

      <SectionCard
        title={t('scanner.rawText', 'Recognized text')}
        action={
          <Tooltip title={t('common.copy', 'Copy')}>
            <span>
              <IconButton
                size="small"
                disabled={!rawText}
                onClick={() => void copyText()}
                data-testid="scanner-copy"
                sx={{ color: tokens.muted }}
              >
                <ContentCopyIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        }
      >
        <Box
          component="pre"
          dir="ltr"
          data-testid="scanner-text"
          sx={{
            m: 0,
            p: 2,
            maxHeight: 320,
            overflow: 'auto',
            borderRadius: 2,
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            color: tokens.text,
            fontFamily: 'monospace',
            fontSize: 12.5,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {rawText || t('scanner.noText', 'No text recognized yet.')}
        </Box>
      </SectionCard>

      <Snackbar
        open={saved}
        autoHideDuration={4000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSaved(false)}
          data-testid="scanner-saved"
          sx={{ width: '100%' }}
        >
          {t('scanner.savedMsg', 'Invoice saved to Files.')}
        </Alert>
      </Snackbar>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={t('scanner.copiedMsg', 'Text copied to clipboard.')}
      />
    </Stack>
  )
}

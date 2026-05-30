import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import GridOnIcon from '@mui/icons-material/GridOn'
import TableRowsIcon from '@mui/icons-material/TableRows'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import { uploadAttachment } from '../../api/attachments'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]
const PREVIEW_LIMIT = 50

type ColumnType = 'number' | 'date' | 'text'

interface ParsedSheet {
  columns: string[]
  rows: string[][]
  totalRows: number
}

function humanSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// Coerce any cell coming from Papa (string) or XLSX (number/Date/etc) to a string.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

// Infer a coarse column type from sampled, non-empty values.
function inferType(values: string[]): ColumnType {
  const sample = values.map((v) => v.trim()).filter((v) => v !== '')
  if (sample.length === 0) return 'text'
  const allNumber = sample.every((v) => v !== '' && !Number.isNaN(Number(v)))
  if (allNumber) return 'number'
  const allDate = sample.every((v) => !Number.isNaN(Date.parse(v)))
  if (allDate) return 'date'
  return 'text'
}

// Normalize a matrix (first row = header) into columns + body rows.
function toSheet(matrix: unknown[][]): ParsedSheet {
  const cleaned = matrix.filter((r) => Array.isArray(r))
  const header = (cleaned[0] ?? []).map((c, i) => {
    const label = cellToString(c).trim()
    return label === '' ? `#${i + 1}` : label
  })
  const body = cleaned.slice(1).map((r) => {
    const out: string[] = []
    for (let i = 0; i < header.length; i += 1) out.push(cellToString(r[i]))
    return out
  })
  return { columns: header, rows: body, totalRows: body.length }
}

export function ImportPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [classification, setClassification] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleFile = (picked: File) => {
    setParseError(null)
    setSheet(null)
    setFile(picked)
    const name = picked.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      picked
        .arrayBuffer()
        .then((buf) => {
          const wb = XLSX.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]!]!
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
          setSheet(toSheet(rows))
        })
        .catch(() => setParseError(t('import.parseError', 'Could not parse this file.')))
    } else {
      Papa.parse(picked, {
        header: false,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = res.data as string[][]
          setSheet(toSheet(rows))
        },
        error: () => setParseError(t('import.parseError', 'Could not parse this file.')),
      })
    }
  }

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !sheet) throw new Error('no file')
      return uploadAttachment({
        file,
        classification,
        kind: 'spreadsheet',
        extracted: {
          columns: sheet.columns,
          preview: sheet.rows.slice(0, PREVIEW_LIMIT),
          total_rows: sheet.totalRows,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
      reset()
    },
  })

  const reset = () => {
    setFile(null)
    setSheet(null)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const previewRows = useMemo(() => sheet?.rows.slice(0, PREVIEW_LIMIT) ?? [], [sheet])

  const columnTypes = useMemo<ColumnType[]>(() => {
    if (!sheet) return []
    return sheet.columns.map((_, ci) => inferType(previewRows.map((r) => r[ci] ?? '')))
  }, [sheet, previewRows])

  const emptyCells = useMemo(() => {
    if (!sheet) return 0
    let count = 0
    for (const row of sheet.rows) {
      for (let i = 0; i < sheet.columns.length; i += 1) {
        if ((row[i] ?? '').trim() === '') count += 1
      }
    }
    return count
  }, [sheet])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (picked) handleFile(picked)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const picked = e.dataTransfer.files?.[0]
    if (picked) handleFile(picked)
  }

  const typeChipColor: Record<ColumnType, string> = {
    number: tokens.cyan,
    date: tokens.green,
    text: tokens.muted,
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('import.title', 'Data Import')}</Typography>
        {file && <Chip size="small" label={file.name} variant="outlined" />}
      </Stack>

      <SectionCard title={t('import.upload', 'Upload file')}>
        <Stack spacing={2}>
          <Box
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            data-testid="import-dropzone"
            sx={{
              cursor: 'pointer',
              borderRadius: 2,
              p: 5,
              textAlign: 'center',
              border: `1px dashed ${dragging ? tokens.gold : tokens.border}`,
              bgcolor: dragging ? 'rgba(201,162,39,0.06)' : tokens.surface2,
              transition: 'border-color .15s, background-color .15s',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 40, color: tokens.gold, mb: 1 }} />
            <Typography sx={{ color: tokens.text }}>
              {t('import.dropHint', 'Drag & drop a CSV or Excel file, or click to browse')}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {t('import.accepted', 'Accepted: .csv, .xlsx, .xls')}
            </Typography>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".csv,.xlsx,.xls"
              onChange={onInputChange}
              data-testid="import-input"
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {t('import.classification', 'Classification')}
            </Typography>
            <Box
              component="select"
              value={classification}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setClassification(Number(e.target.value))
              }
              data-testid="import-classification"
              sx={{
                bgcolor: tokens.surface3,
                color: tokens.text,
                border: `1px solid ${tokens.border}`,
                borderRadius: 1,
                px: 1.5,
                py: 1,
                fontFamily: 'inherit',
                fontSize: 14,
              }}
            >
              {CLEARANCES.map((n) => (
                <option key={n} value={n}>
                  {t(`clearance.${n}`)}
                </option>
              ))}
            </Box>
            <ClassificationBadge level={classification} />
          </Box>

          {parseError && (
            <Alert severity="error" data-testid="import-error">
              {parseError}
            </Alert>
          )}
          {uploadMutation.isError && (
            <Alert severity="error">
              {t('import.uploadError', 'Import failed. Please try again.')}
            </Alert>
          )}
          {uploadMutation.isSuccess && (
            <Alert severity="success" data-testid="import-success">
              {t('import.success', 'File imported successfully.')}
            </Alert>
          )}
        </Stack>
      </SectionCard>

      {sheet && (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('import.rows', 'Rows')}
                value={<span data-testid="import-rowcount">{sheet.totalRows}</span>}
                accent={tokens.gold}
                icon={<TableRowsIcon />}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('import.columns', 'Columns')}
                value={sheet.columns.length}
                accent={tokens.cyan}
                icon={<ViewColumnIcon />}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
              <StatCard
                label={t('import.fileSize', 'File size')}
                value={humanSize(file?.size ?? 0)}
                accent={tokens.green}
                icon={<GridOnIcon />}
              />
            </Box>
          </Box>

          {emptyCells > 0 && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon fontSize="inherit" />}
              data-testid="import-warnings"
            >
              {t('import.emptyCells', 'Empty cells detected')}: {emptyCells}
            </Alert>
          )}

          <SectionCard
            title={t('import.preview', 'Preview')}
            action={
              <Typography variant="caption" sx={{ color: tokens.muted }}>
                {t('import.previewNote', 'First 50 rows')}
              </Typography>
            }
          >
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small" data-testid="import-preview-table">
                <TableHead>
                  <TableRow>
                    {sheet.columns.map((col, ci) => (
                      <TableCell
                        key={`${col}-${ci}`}
                        sx={{
                          bgcolor: tokens.surface2,
                          color: tokens.text,
                          fontWeight: 700,
                          borderBottom: `2px solid ${tokens.borderGold}`,
                        }}
                      >
                        <Stack spacing={0.5} alignItems="flex-start">
                          <span>{col}</span>
                          <Chip
                            size="small"
                            label={t(`import.type.${columnTypes[ci]}`, columnTypes[ci]!)}
                            data-testid="import-coltype"
                            sx={{
                              height: 18,
                              fontSize: 10,
                              color: typeChipColor[columnTypes[ci]!],
                              borderColor: typeChipColor[columnTypes[ci]!],
                            }}
                            variant="outlined"
                          />
                        </Stack>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, ri) => (
                    <TableRow key={ri} data-testid="import-row">
                      {sheet.columns.map((_, ci) => (
                        <TableCell
                          key={ci}
                          sx={{
                            color: (row[ci] ?? '').trim() === '' ? tokens.red : tokens.text,
                          }}
                        >
                          {(row[ci] ?? '').trim() === '' ? '—' : row[ci]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>

          <Box sx={{ display: 'flex', justifyContent: ar ? 'flex-start' : 'flex-end', gap: 1.5 }}>
            <Button color="inherit" onClick={reset} data-testid="import-reset">
              {t('import.reset', 'Reset')}
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              data-testid="import-save"
            >
              {t('import.save', 'Import')}
            </Button>
          </Box>
        </>
      )}
    </Stack>
  )
}

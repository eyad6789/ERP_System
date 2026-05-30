import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

// Frontend-only no-code form designer. Everything persists to localStorage;
// no network calls. Schemas are validated/guarded on load to stay TS-strict.
const STORAGE_KEY = 'erp.forms'

const FIELD_TYPES = ['text', 'number', 'select', 'date', 'checkbox', 'textarea'] as const
type FieldType = (typeof FIELD_TYPES)[number]

interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  options: string[]
}

interface FormSchema {
  id: string
  name: string
  fields: FormField[]
}

function newId(): string {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return `${buf[0]!.toString(36)}${buf[1]!.toString(36)}`
}

function isFieldType(v: unknown): v is FieldType {
  return typeof v === 'string' && (FIELD_TYPES as readonly string[]).includes(v)
}

// Defensive parse: localStorage is user-writable, so guard every property.
function parseForms(raw: string | null): FormSchema[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: FormSchema[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || typeof rec.name !== 'string') continue
    if (!Array.isArray(rec.fields)) continue
    const fields: FormField[] = []
    for (const f of rec.fields) {
      if (typeof f !== 'object' || f === null) continue
      const fr = f as Record<string, unknown>
      if (typeof fr.id !== 'string' || typeof fr.label !== 'string') continue
      if (!isFieldType(fr.type)) continue
      const options = Array.isArray(fr.options)
        ? fr.options.filter((o): o is string => typeof o === 'string')
        : []
      fields.push({
        id: fr.id,
        type: fr.type,
        label: fr.label,
        required: fr.required === true,
        options,
      })
    }
    out.push({ id: rec.id, name: rec.name, fields })
  }
  return out
}

// Renders a single field as a live MUI control (preview only, non-binding).
function PreviewField({ field, label }: { field: FormField; label: string }) {
  switch (field.type) {
    case 'select':
      return (
        <TextField select label={label} fullWidth size="small" defaultValue="">
          {field.options.length === 0 ? (
            <MenuItem value="" disabled>
              —
            </MenuItem>
          ) : (
            field.options.map((opt, i) => (
              <MenuItem key={`${opt}-${i}`} value={opt}>
                {opt}
              </MenuItem>
            ))
          )}
        </TextField>
      )
    case 'checkbox':
      return <FormControlLabel control={<Checkbox />} label={label} />
    case 'textarea':
      return <TextField label={label} fullWidth size="small" multiline minRows={3} />
    case 'date':
      return (
        <TextField
          label={label}
          fullWidth
          size="small"
          type="date"
          InputLabelProps={{ shrink: true }}
        />
      )
    case 'number':
      return <TextField label={label} fullWidth size="small" type="number" />
    case 'text':
    default:
      return <TextField label={label} fullWidth size="small" />
  }
}

export function FormBuilderPage() {
  const { t } = useTranslation()

  const [saved, setSaved] = useState<FormSchema[]>(() =>
    parseForms(localStorage.getItem(STORAGE_KEY)),
  )

  const [formName, setFormName] = useState('')
  const [fields, setFields] = useState<FormField[]>([])

  // Draft of the field being composed in the left panel.
  const [draftType, setDraftType] = useState<FieldType>('text')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftRequired, setDraftRequired] = useState(false)
  const [draftOptions, setDraftOptions] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }, [saved])

  const addField = () => {
    const label = draftLabel.trim()
    if (label === '') return
    const options =
      draftType === 'select'
        ? draftOptions
            .split(',')
            .map((o) => o.trim())
            .filter((o) => o !== '')
        : []
    setFields((prev) => [
      ...prev,
      { id: newId(), type: draftType, label, required: draftRequired, options },
    ])
    setDraftLabel('')
    setDraftRequired(false)
    setDraftOptions('')
  }

  const moveField = (index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const a = next[index]
      const b = next[target]
      if (!a || !b) return prev
      next[index] = b
      next[target] = a
      return next
    })
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  const saveForm = () => {
    const name = formName.trim()
    if (name === '' || fields.length === 0) return
    const schema: FormSchema = { id: newId(), name, fields }
    setSaved((prev) => [schema, ...prev])
    setFormName('')
    setFields([])
  }

  const deleteSaved = (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id))
  }

  const canSave = formName.trim() !== '' && fields.length > 0

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.forms', 'Form Builder')}</Typography>
        <Chip size="small" label={fields.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
        {/* LEFT: field composer + ordered field list */}
        <SectionCard title={t('forms.designer', 'Designer')} sx={{ flex: 1, minWidth: 340 }}>
          <Stack spacing={2}>
            <TextField
              label={t('forms.formName', 'Form name')}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'form-name' }}
            />

            <Divider textAlign="left" sx={{ color: tokens.muted, fontSize: 12 }}>
              {t('forms.addField', 'Add field')}
            </Divider>

            <TextField
              select
              label={t('forms.fieldType', 'Field type')}
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as FieldType)}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'draft-type' }}
            >
              {FIELD_TYPES.map((ty) => (
                <MenuItem key={ty} value={ty}>
                  {t(`forms.type.${ty}`, ty)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t('forms.fieldLabel', 'Field label')}
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'draft-label' }}
            />

            {draftType === 'select' && (
              <TextField
                label={t('forms.options', 'Options (comma separated)')}
                value={draftOptions}
                onChange={(e) => setDraftOptions(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ 'data-testid': 'draft-options' }}
              />
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={draftRequired}
                  onChange={(e) => setDraftRequired(e.target.checked)}
                />
              }
              label={t('forms.required', 'Required')}
            />

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addField}
              disabled={draftLabel.trim() === ''}
              data-testid="add-field"
            >
              {t('forms.addField', 'Add field')}
            </Button>

            <Divider sx={{ borderColor: tokens.border }} />

            {fields.length === 0 ? (
              <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
                {t('forms.noFields', 'No fields yet. Add one above.')}
              </Typography>
            ) : (
              <Stack spacing={1} data-testid="field-list">
                {fields.map((f, i) => (
                  <Box
                    key={f.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1,
                      border: `1px solid ${tokens.border}`,
                      bgcolor: tokens.surface2,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: tokens.text, fontSize: 14 }} noWrap>
                        {f.label}
                        {f.required && (
                          <Box component="span" sx={{ color: tokens.red, ml: 0.5 }}>
                            *
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ color: tokens.muted, fontSize: 11 }}>
                        {t(`forms.type.${f.type}`, f.type)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={t('forms.moveUp', 'Move up')}
                      disabled={i === 0}
                      onClick={() => moveField(i, -1)}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('forms.moveDown', 'Move down')}
                      disabled={i === fields.length - 1}
                      onClick={() => moveField(i, 1)}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete', 'Delete')}
                      onClick={() => removeField(f.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            <Button
              variant="outlined"
              startIcon={<SaveOutlinedIcon />}
              onClick={saveForm}
              disabled={!canSave}
              data-testid="save-form"
            >
              {t('forms.save', 'Save form')}
            </Button>
          </Stack>
        </SectionCard>

        {/* RIGHT: live preview of the in-progress field list */}
        <SectionCard title={t('forms.livePreview', 'Live preview')} sx={{ flex: 1, minWidth: 340 }}>
          {fields.length === 0 ? (
            <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
              {t('forms.previewEmpty', 'Your form preview appears here.')}
            </Typography>
          ) : (
            <Stack spacing={2} data-testid="preview">
              {formName.trim() !== '' && (
                <Typography variant="subtitle1" sx={{ color: tokens.gold }}>
                  {formName}
                </Typography>
              )}
              {fields.map((f) => (
                <PreviewField
                  key={f.id}
                  field={f}
                  label={f.required ? `${f.label} *` : f.label}
                />
              ))}
            </Stack>
          )}
        </SectionCard>
      </Box>

      {/* Saved schemas */}
      <SectionCard title={t('forms.saved', 'Saved forms')}>
        {saved.length === 0 ? (
          <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
            {t('forms.noneSaved', 'No saved forms yet.')}
          </Typography>
        ) : (
          <Stack spacing={1} data-testid="saved-list">
            {saved.map((s) => (
              <Box
                key={s.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  border: `1px solid ${tokens.border}`,
                  bgcolor: tokens.surface2,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: tokens.text }} noWrap>
                    {s.name}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('forms.fieldCount', '{{count}} fields', { count: s.fields.length })}
                />
                <IconButton
                  size="small"
                  aria-label={t('common.delete', 'Delete')}
                  onClick={() => deleteSaved(s.id)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  )
}

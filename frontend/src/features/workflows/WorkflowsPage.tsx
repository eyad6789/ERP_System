import AddIcon from '@mui/icons-material/Add'
import BoltIcon from '@mui/icons-material/Bolt'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import RuleIcon from '@mui/icons-material/Rule'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STORAGE_KEY = 'erp.workflows'

const TRIGGERS = [
  'incident_created',
  'contract_expiring',
  'asset_down',
  'leave_requested',
  'login_failed',
] as const
type Trigger = (typeof TRIGGERS)[number]

const ACTIONS = ['notify', 'email', 'escalate', 'create_task', 'lock_account'] as const
type Action = (typeof ACTIONS)[number]

interface WorkflowRule {
  id: string
  trigger: Trigger
  action: Action
  condition: string
  enabled: boolean
}

function isTrigger(value: unknown): value is Trigger {
  return typeof value === 'string' && (TRIGGERS as readonly string[]).includes(value)
}

function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}

// Tolerant parse of persisted rules — drops anything malformed so a corrupted
// localStorage blob never crashes the page.
function loadRules(): WorkflowRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): WorkflowRule[] => {
      if (typeof item !== 'object' || item === null) return []
      const r = item as Record<string, unknown>
      if (!isTrigger(r.trigger) || !isAction(r.action)) return []
      return [
        {
          id: typeof r.id === 'string' ? r.id : newId(),
          trigger: r.trigger,
          action: r.action,
          condition: typeof r.condition === 'string' ? r.condition : '',
          enabled: r.enabled !== false,
        },
      ]
    })
  } catch {
    return []
  }
}

function newId(): string {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return `wf_${buf[0]!.toString(36)}${buf[1]!.toString(36)}`
}

export function WorkflowsPage() {
  const { t } = useTranslation()

  const [rules, setRules] = useState<WorkflowRule[]>(() => loadRules())
  const [trigger, setTrigger] = useState<Trigger>('incident_created')
  const [action, setAction] = useState<Action>('notify')
  const [condition, setCondition] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  }, [rules])

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules])

  const triggerLabel = (key: Trigger) => t(`workflows.trigger.${key}`, key)
  const actionLabel = (key: Action) => t(`workflows.action.${key}`, key)

  const handleCreate = () => {
    const rule: WorkflowRule = {
      id: newId(),
      trigger,
      action,
      condition: condition.trim(),
      enabled,
    }
    setRules((prev) => [rule, ...prev])
    setCondition('')
    setEnabled(true)
  }

  const toggleRule = (id: string) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))

  const deleteRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.workflows', 'Workflows')}</Typography>
        <Chip size="small" label={rules.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('workflows.totalRules', 'Total Rules')}
            value={rules.length}
            accent={tokens.gold}
            icon={<RuleIcon />}
          />
        </Box>
        <Box data-testid="kpi-active" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('workflows.activeRules', 'Active Rules')}
            value={activeCount}
            accent={tokens.green}
            icon={<BoltIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('workflows.newRule', 'New Automation Rule')}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label={t('workflows.when', 'When (trigger)')}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as Trigger)}
              fullWidth
              inputProps={{ 'data-testid': 'field-trigger' }}
            >
              {TRIGGERS.map((trg) => (
                <MenuItem key={trg} value={trg}>
                  {triggerLabel(trg)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('workflows.then', 'Then (action)')}
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
              fullWidth
              inputProps={{ 'data-testid': 'field-action' }}
            >
              {ACTIONS.map((act) => (
                <MenuItem key={act} value={act}>
                  {actionLabel(act)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label={t('workflows.condition', 'Condition (optional)')}
            placeholder={t('workflows.conditionHint', 'e.g. severity = high')}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            fullWidth
            inputProps={{ 'data-testid': 'field-condition' }}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                inputProps={{ 'aria-label': t('workflows.enabled', 'Enabled') }}
              />
              <Typography sx={{ color: tokens.muted }}>
                {t('workflows.enabled', 'Enabled')}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
              data-testid="rule-create"
            >
              {t('workflows.addRule', 'Add Rule')}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title={t('workflows.rules', 'Automation Rules')}>
        {rules.length === 0 ? (
          <Typography sx={{ color: tokens.muted, py: 2 }} data-testid="rules-empty">
            {t('workflows.empty', 'No automation rules yet. Create one above.')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {rules.map((rule) => (
              <Box
                key={rule.id}
                data-testid="rule-card"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.75,
                  borderRadius: 1,
                  border: `1px solid ${tokens.border}`,
                  bgcolor: tokens.surface2,
                  opacity: rule.enabled ? 1 : 0.55,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: tokens.text }}>
                    <Box component="span" sx={{ color: tokens.gold, fontWeight: 700 }}>
                      {t('workflows.if', 'IF')}
                    </Box>{' '}
                    {triggerLabel(rule.trigger)}
                    {rule.condition && (
                      <>
                        {' '}
                        <Box component="span" sx={{ color: tokens.muted }}>
                          ({rule.condition})
                        </Box>
                      </>
                    )}{' '}
                    <Box component="span" sx={{ color: tokens.gold, fontWeight: 700 }}>
                      {t('workflows.thenWord', 'THEN')}
                    </Box>{' '}
                    {actionLabel(rule.action)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<PowerSettingsNewIcon />}
                  color={rule.enabled ? 'success' : 'default'}
                  label={
                    rule.enabled
                      ? t('workflows.active', 'Active')
                      : t('workflows.disabled', 'Disabled')
                  }
                />
                <Switch
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  inputProps={{ 'aria-label': t('workflows.toggle', 'Toggle rule') }}
                  data-testid="rule-toggle"
                />
                <IconButton
                  size="small"
                  aria-label={t('common.delete', 'Delete')}
                  onClick={() => deleteRule(rule.id)}
                  data-testid="rule-delete"
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

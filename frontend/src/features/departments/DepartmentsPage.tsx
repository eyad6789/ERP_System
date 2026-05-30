import AccountTreeIcon from '@mui/icons-material/AccountTree'
import GroupsIcon from '@mui/icons-material/Groups'
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchOrgTree, type OrgNode } from '../../api/org'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

// A department node enriched with its resolved children (built from the flat list).
interface TreeNode extends OrgNode {
  children: TreeNode[]
}

// Build a parent -> children forest from the flat list. Nodes whose `parent`
// is null or points at a code we never saw are treated as roots.
function buildForest(nodes: OrgNode[]): TreeNode[] {
  const byCode = new Map<string, TreeNode>()
  for (const n of nodes) {
    byCode.set(n.code, { ...n, children: [] })
  }
  const roots: TreeNode[] = []
  for (const n of nodes) {
    const self = byCode.get(n.code)
    if (!self) continue
    const parent = n.parent !== null ? byCode.get(n.parent) : undefined
    if (parent) parent.children.push(self)
    else roots.push(self)
  }
  return roots
}

function DepartmentRow({ node, depth }: { node: TreeNode; depth: number }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const name = ar ? node.name_ar : node.name_en

  return (
    <Box>
      <Box
        data-testid="department-row"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          py: 1.1,
          px: 1.5,
          ms: { xs: 0 },
          marginInlineStart: depth * 3,
          borderInlineStart:
            depth > 0 ? `2px solid ${tokens.borderGold}` : `2px solid ${tokens.gold}`,
          borderRadius: 1,
          bgcolor: depth === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          '&:hover': { bgcolor: tokens.surface3 },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: depth === 0 ? tokens.gold : tokens.muted,
            }}
          />
          <Typography
            noWrap
            sx={{
              color: tokens.text,
              fontWeight: depth === 0 ? 600 : 400,
              fontSize: depth === 0 ? 15 : 14,
            }}
          >
            {name}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {node.code}
          </Typography>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          icon={<GroupsIcon style={{ fontSize: 15 }} />}
          label={`${node.member_count} ${t('departments.members', 'members')}`}
          sx={{ color: tokens.muted, borderColor: tokens.border, flexShrink: 0 }}
        />
      </Box>
      {node.children.map((child) => (
        <DepartmentRow key={child.code} node={child} depth={depth + 1} />
      ))}
    </Box>
  )
}

export function DepartmentsPage() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['org-tree'],
    queryFn: fetchOrgTree,
  })

  const nodes: OrgNode[] = useMemo(() => data ?? [], [data])
  const forest = useMemo(() => buildForest(nodes), [nodes])
  const totalMembers = useMemo(
    () => nodes.reduce((sum, n) => sum + n.member_count, 0),
    [nodes],
  )

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
        <Typography variant="h5">{t('nav.departments', 'Departments')}</Typography>
        <Chip size="small" label={nodes.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-departments" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('departments.total', 'Total Departments')}
            value={nodes.length}
            accent={tokens.gold}
            icon={<AccountTreeIcon />}
          />
        </Box>
        <Box data-testid="kpi-members" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('departments.totalMembers', 'Total Members')}
            value={totalMembers}
            accent={tokens.cyan}
            icon={<GroupsIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('departments.hierarchy', 'Organizational Structure')}>
        {forest.length === 0 ? (
          <Typography sx={{ color: tokens.muted, py: 2 }}>
            {t('departments.empty', 'No departments to display.')}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {forest.map((root) => (
              <DepartmentRow key={root.code} node={root} depth={0} />
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  )
}

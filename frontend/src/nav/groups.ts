// Department taxonomy — the single source of truth for how the ~50 pages are
// ranked into department categories in the sidebar. Every navigable item belongs
// to exactly one department "workspace". A department also has an OWNER (the
// department string carried on the user) that is allowed to edit that workspace.
import { tokens } from '../theme/tokens'

export interface NavGroup {
  key: string
  name_en: string
  name_ar: string
  icon: string // resolved to an MUI icon component in Sidebar
  ownerDept: string // department that owns (and may edit) this workspace
  accent: string
  items: readonly string[] // nav keys (= route paths) in display order
}

// Clearance-gated modules: these are locked when the user's role does not grant
// them (server is the source of truth; the lock only mirrors what the API forbids).
// Everything NOT in this set is an always-available platform tool.
export const GATED_MODULES: ReadonlySet<string> = new Set([
  'dashboard', 'personnel', 'documents', 'files', 'finance', 'operations',
  'assets', 'gis', 'incidents', 'projects', 'procurement', 'inventory', 'fleet',
  'risk', 'knowledge', 'attendance', 'leave', 'payroll', 'helpdesk', 'compliance',
  'meetings', 'recruitment', 'performance', 'training', 'contracts',
  'announcements', 'events', 'audit',
])

// Items that should only render for a sysadmin.
export const SYSADMIN_ONLY: ReadonlySet<string> = new Set(['admin'])

export function isGated(item: string): boolean {
  return GATED_MODULES.has(item)
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: 'command',
    name_en: 'Command Center',
    name_ar: 'مركز القيادة',
    icon: 'command',
    ownerDept: 'Operations',
    accent: tokens.gold,
    items: ['dashboard', 'activity', 'reports', 'builder', 'reportbuilder', 'twin', 'calendar'],
  },
  {
    key: 'hr',
    name_en: 'Human Resources',
    name_ar: 'الموارد البشرية',
    icon: 'hr',
    ownerDept: 'HR',
    accent: tokens.cyan,
    items: [
      'personnel', 'departments', 'workspaces', 'attendance', 'leave', 'payroll',
      'recruitment', 'performance', 'training',
    ],
  },
  {
    key: 'finance',
    name_en: 'Finance & Procurement',
    name_ar: 'المالية والمشتريات',
    icon: 'finance',
    ownerDept: 'Finance',
    accent: tokens.green,
    items: ['finance', 'procurement', 'inventory', 'assets', 'contracts'],
  },
  {
    key: 'operations',
    name_en: 'Operations & Field',
    name_ar: 'العمليات والميدان',
    icon: 'operations',
    ownerDept: 'Operations',
    accent: tokens.orange,
    items: ['operations', 'projects', 'fleet', 'gis', 'incidents', 'meetings', 'events'],
  },
  {
    key: 'records',
    name_en: 'Records & Knowledge',
    name_ar: 'السجلات والمعرفة',
    icon: 'records',
    ownerDept: 'Records',
    accent: tokens.gold,
    items: [
      'documents', 'files', 'knowledge', 'archive', 'ocr', 'scanner',
      'import', 'signatures', 'forms',
    ],
  },
  {
    key: 'service',
    name_en: 'Service & Engagement',
    name_ar: 'الخدمة والتواصل',
    icon: 'service',
    ownerDept: 'Service',
    accent: tokens.cyan,
    items: ['helpdesk', 'chat', 'announcements', 'workflows'],
  },
  {
    key: 'governance',
    name_en: 'Governance & Security',
    name_ar: 'الحوكمة والأمن',
    icon: 'governance',
    ownerDept: 'Intelligence',
    accent: tokens.red,
    items: ['compliance', 'risk', 'audit', 'security'],
  },
  {
    key: 'platform',
    name_en: 'Platform & Admin',
    name_ar: 'المنصة والإدارة',
    icon: 'platform',
    ownerDept: 'IT',
    accent: tokens.muted,
    items: ['marketplace', 'integrations', 'developers', 'admin', 'settings'],
  },
]

import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { AdminPage } from './features/admin/AdminPage'
import { AssetsPage } from './features/assets/AssetsPage'
import { AuditPage } from './features/audit/AuditPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { FinancePage } from './features/finance/FinancePage'
import { FleetPage } from './features/fleet/FleetPage'
import { GisPage } from './features/gis/GisPage'
import { IncidentsPage } from './features/incidents/IncidentsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { KnowledgePage } from './features/knowledge/KnowledgePage'
import { LoginPage } from './features/login/LoginPage'
import { OperationsPage } from './features/operations/OperationsPage'
import { PersonnelPage } from './features/personnel/PersonnelPage'
import { ProcurementPage } from './features/procurement/ProcurementPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { RiskPage } from './features/risk/RiskPage'
import { SecurityPage } from './features/security/SecurityPage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/gis" element={<GisPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/procurement" element={<ProcurementPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

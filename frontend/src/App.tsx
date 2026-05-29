import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { AssetsPage } from './features/assets/AssetsPage'
import { AuditPage } from './features/audit/AuditPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { FinancePage } from './features/finance/FinancePage'
import { GisPage } from './features/gis/GisPage'
import { IncidentsPage } from './features/incidents/IncidentsPage'
import { LoginPage } from './features/login/LoginPage'
import { OperationsPage } from './features/operations/OperationsPage'
import { PersonnelPage } from './features/personnel/PersonnelPage'
import { ProfilePage } from './features/profile/ProfilePage'

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
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

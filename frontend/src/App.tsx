import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { ActivityStreamPage } from './features/activity/ActivityStreamPage'
import { ArchivePage } from './features/archive/ArchivePage'
import { DashboardBuilderPage } from './features/builder/DashboardBuilderPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { ChatPage } from './features/chat/ChatPage'
import { DepartmentsPage } from './features/departments/DepartmentsPage'
import { DevelopersPage } from './features/developers/DevelopersPage'
import { FilesPage } from './features/files/FilesPage'
import { FormBuilderPage } from './features/forms/FormBuilderPage'
import { ImportPage } from './features/import/ImportPage'
import { IntegrationsPage } from './features/integrations/IntegrationsPage'
import { MarketplacePage } from './features/marketplace/MarketplacePage'
import { OcrPage } from './features/ocr/OcrPage'
import { ScannerPage } from './features/scanner/ScannerPage'
import { ReportBuilderPage } from './features/reportbuilder/ReportBuilderPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SignaturesPage } from './features/signatures/SignaturesPage'
import { DigitalTwinPage } from './features/twin/DigitalTwinPage'
import { WorkflowsPage } from './features/workflows/WorkflowsPage'
import { WorkspacesPage } from './features/workspaces/WorkspacesPage'
import { AdminPage } from './features/admin/AdminPage'
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage'
import { AssetsPage } from './features/assets/AssetsPage'
import { AttendancePage } from './features/attendance/AttendancePage'
import { AuditPage } from './features/audit/AuditPage'
import { CompliancePage } from './features/compliance/CompliancePage'
import { ContractsPage } from './features/contracts/ContractsPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { EventsPage } from './features/events/EventsPage'
import { FinancePage } from './features/finance/FinancePage'
import { FleetPage } from './features/fleet/FleetPage'
import { GisPage } from './features/gis/GisPage'
import { HelpDeskPage } from './features/helpdesk/HelpDeskPage'
import { IncidentsPage } from './features/incidents/IncidentsPage'
import { InventoryPage } from './features/inventory/InventoryPage'
import { KnowledgePage } from './features/knowledge/KnowledgePage'
import { LeavePage } from './features/leave/LeavePage'
import { LoginPage } from './features/login/LoginPage'
import { MeetingsPage } from './features/meetings/MeetingsPage'
import { OperationsPage } from './features/operations/OperationsPage'
import { PayrollPage } from './features/payroll/PayrollPage'
import { PerformancePage } from './features/performance/PerformancePage'
import { PersonnelPage } from './features/personnel/PersonnelPage'
import { ProcurementPage } from './features/procurement/ProcurementPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { RecruitmentPage } from './features/recruitment/RecruitmentPage'
import { RiskPage } from './features/risk/RiskPage'
import { SecurityPage } from './features/security/SecurityPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TrainingPage } from './features/training/TrainingPage'

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
        <Route path="/files" element={<FilesPage />} />
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
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/helpdesk" element={<HelpDeskPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/recruitment" element={<RecruitmentPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/activity" element={<ActivityStreamPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/forms" element={<FormBuilderPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/ocr" element={<OcrPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/signatures" element={<SignaturesPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/builder" element={<DashboardBuilderPage />} />
        <Route path="/reportbuilder" element={<ReportBuilderPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/twin" element={<DigitalTwinPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

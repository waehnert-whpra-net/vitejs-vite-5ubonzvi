import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useHasRole } from '@/hooks/usePermissions'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ContactList from '@/pages/ContactList'
import ContactForm from '@/pages/ContactForm'
import AreaList from '@/modules/properties/pages/AreaList'
import AreaForm from '@/modules/properties/pages/AreaForm'
import UnitList from '@/modules/properties/pages/UnitList'
import UnitForm from '@/modules/properties/pages/UnitForm'
import UsageList from '@/modules/properties/pages/UsageList'
import UsageForm from '@/modules/properties/pages/UsageForm'
import GroupUsageForm from '@/modules/properties/pages/GroupUsageForm'
import CalendarView from '@/modules/calendar/pages/CalendarView'
import UserList from '@/pages/UserList'
import UserForm from '@/pages/UserForm'
import OptionsPage from '@/pages/accounting/OptionsPage'
import SetupPage from '@/pages/accounting/SetupPage'
import TransactionsPage from '@/pages/accounting/TransactionsPage'
import AccountTypesPage from '@/pages/accounting/AccountTypesPage'
import ImportPatternsPage from '@/pages/accounting/ImportPatternsPage'
import Skr03Page from '@/pages/accounting/Skr03Page'
import BuchungssaetzePage from '@/pages/accounting/BuchungssaetzePage'
import BuchungenPage from '@/pages/accounting/BuchungenPage'
import ResetPassword from '@/pages/ResetPassword'
import DataCleanupPage from '@/pages/DataCleanupPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 }
  }
})

function AppRoutes() {
  const { user, loading } = useAuth()
  const { data: hasRole, isLoading: roleLoading } = useHasRole()

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Wird geladen...</p>
        </div>
      </div>
    )
  }

  // Passwort-Reset-Seite ist ohne Login erreichbar
  if (window.location.pathname === '/reset-password') return <ResetPassword />

  if (!user) return <Login />

  // Nutzer ohne zugewiesene Rolle: nur Dashboard sichtbar
  if (hasRole === false) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id/edit" element={<ContactForm />} />
          <Route path="properties/areas" element={<AreaList />} />
          <Route path="properties/areas/new" element={<AreaForm />} />
          <Route path="properties/areas/:id/edit" element={<AreaForm />} />
          <Route path="properties/units" element={<UnitList />} />
          <Route path="properties/units/new" element={<UnitForm />} />
          <Route path="properties/units/:id/edit" element={<UnitForm />} />
          <Route path="properties/usages" element={<UsageList />} />
          <Route path="properties/usages/new" element={<UsageForm />} />
          <Route path="properties/usages/:id/edit" element={<UsageForm />} />
          <Route path="properties/group-usages/new" element={<GroupUsageForm />} />
          <Route path="properties/group-usages/:id/edit" element={<GroupUsageForm />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/new" element={<UserForm />} />
          <Route path="users/:id/edit" element={<UserForm />} />
          <Route path="options" element={<OptionsPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="accounting/transactions" element={<TransactionsPage />} />
          <Route path="accounting/account-types" element={<AccountTypesPage />} />
          <Route path="accounting/import-patterns" element={<ImportPatternsPage />} />
          <Route path="accounting/skr03" element={<Skr03Page />} />
          <Route path="accounting/buchungssaetze" element={<BuchungssaetzePage />} />
          <Route path="accounting/buchungen" element={<BuchungenPage />} />
          <Route path="admin/data-cleanup" element={<DataCleanupPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}

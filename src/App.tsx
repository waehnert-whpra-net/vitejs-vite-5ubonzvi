import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import ContactList from '@/pages/ContactList'
import ContactForm from '@/pages/ContactForm'
import AreaList from '@/modules/properties/pages/AreaList'
import AreaForm from '@/modules/properties/pages/AreaForm'
import UnitList from '@/modules/properties/pages/UnitList'
import UnitForm from '@/modules/properties/pages/UnitForm'
import UsageList from '@/modules/properties/pages/UsageList'
import UsageForm from '@/modules/properties/pages/UsageForm'
import CalendarView from '@/modules/calendar/pages/CalendarView'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    }
  }
})

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Wird geladen...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/contacts" replace />} />
          {/* Kontakte */}
          <Route path="contacts" element={<ContactList />} />
          <Route path="contacts/new" element={<ContactForm />} />
          <Route path="contacts/:id/edit" element={<ContactForm />} />
          {/* Bereiche */}
          <Route path="properties/areas" element={<AreaList />} />
          <Route path="properties/areas/new" element={<AreaForm />} />
          <Route path="properties/areas/:id/edit" element={<AreaForm />} />
          {/* Einheiten */}
          <Route path="properties/units" element={<UnitList />} />
          <Route path="properties/units/new" element={<UnitForm />} />
          <Route path="properties/units/:id/edit" element={<UnitForm />} />
          {/* Nutzungen */}
          <Route path="properties/usages" element={<UsageList />} />
          <Route path="properties/usages/new" element={<UsageForm />} />
          <Route path="properties/usages/:id/edit" element={<UsageForm />} />
          <Route path="*" element={<Navigate to="/contacts" replace />} />
          {/* Kalender */}
          <Route path="calendar" element={<CalendarView />} />
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
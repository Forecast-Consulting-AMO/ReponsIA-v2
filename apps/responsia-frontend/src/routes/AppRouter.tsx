import { Routes, Route, Navigate } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import { useAuth } from '../hooks/useAuth'
import { Layout } from '../components/Layout'
import { DashboardPage } from '../pages/DashboardPage'
import { ProjectPage } from '../pages/ProjectPage'
import { SettingsPage } from '../pages/SettingsPage'
import { LoginPage } from '../pages/LoginPage'

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

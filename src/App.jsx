import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import { LanguageProvider } from './lib/i18n.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import JobDetail from './pages/JobDetail.jsx'
import PostJob from './pages/PostJob.jsx'
import Saved from './pages/Saved.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import SeekerDashboard from './pages/SeekerDashboard.jsx'
import Applications from './pages/Applications.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import Resume from './pages/Resume.jsx'
import Settings from './pages/Settings.jsx'
import EmployerDashboard from './pages/EmployerDashboard.jsx'
import EmployerJobs from './pages/EmployerJobs.jsx'
import JobEdit from './pages/JobEdit.jsx'
import CompanyProfile from './pages/CompanyProfile.jsx'
import Verification from './pages/Verification.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminCategories from './pages/AdminCategories.jsx'
import AdminVerifications from './pages/AdminVerifications.jsx'
import AdminJobs from './pages/AdminJobs.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminAudit from './pages/AdminAudit.jsx'
import AdminAnalytics from './pages/AdminAnalytics.jsx'
import Applicants from './pages/Applicants.jsx'
import NotFound from './pages/NotFound.jsx'
import { useStore } from './lib/store.jsx'

function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

export default function App() {
  const { toast } = useStore()

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <LanguageProvider>
        <Header />

        <main className="flex-1">
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/post" element={<PostJob />} />
          <Route path="/saved" element={<Saved />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Role-gated areas */}
          <Route
            path="/me"
            element={
              <RequireAuth role="seeker">
                <SeekerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/me/profile"
            element={
              <RequireAuth role="seeker">
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/me/resume"
            element={
              <RequireAuth role="seeker">
                <Resume />
              </RequireAuth>
            }
          />
          <Route
            path="/me/settings"
            element={
              <RequireAuth role="seeker">
                <Settings />
              </RequireAuth>
            }
          />
          <Route
            path="/me/applications"
            element={
              <RequireAuth role="seeker">
                <Applications />
              </RequireAuth>
            }
          />
          <Route
            path="/me/notifications"
            element={
              <RequireAuth role="seeker">
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="/employer"
            element={
              <RequireAuth role="employer">
                <EmployerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/employer/company"
            element={
              <RequireAuth role="employer">
                <CompanyProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/employer/jobs"
            element={
              <RequireAuth role="employer">
                <EmployerJobs />
              </RequireAuth>
            }
          />
          <Route
            path="/employer/jobs/:id"
            element={
              <RequireAuth role="employer">
                <JobEdit />
              </RequireAuth>
            }
          />
          <Route
            path="/employer/verification"
            element={
              <RequireAuth role="employer">
                <Verification />
              </RequireAuth>
            }
          />
          <Route
            path="/employer/applicants"
            element={
              <RequireAuth role="employer">
                <Applicants />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth role="admin">
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth role="admin">
                <AdminUsers />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <RequireAuth role="admin">
                <AdminCategories />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/verifications"
            element={
              <RequireAuth role="admin">
                <AdminVerifications />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/jobs"
            element={
              <RequireAuth role="admin">
                <AdminJobs />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RequireAuth role="admin">
                <AdminReports />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequireAuth role="admin">
                <AdminAudit />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <RequireAuth role="admin">
                <AdminAnalytics />
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </main>

        <Footer />
      </LanguageProvider>

      <div role="status" aria-live="polite" className="pointer-events-none">
        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-ink shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

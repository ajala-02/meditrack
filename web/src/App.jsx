import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import PatientDetail from "./pages/patients/PatientDetail";
import EnrollPatient from "./pages/patients/EnrollPatient";
import PatientHome from "./pages/patients/patienthome";
import PatientCheckIn from "./pages/patients/PatientCheckIn";
import RecoveryPlan from "./pages/patients/RecoveryPlan";
import AdminPanel from "./pages/admin/AdminPanel";
import AICompanion from "./pages/patients/AICompanion";
import Messages from "./pages/patients/Messages";
import Timeline from "./pages/patients/Timeline";
import "./index.css";

const ROLE_ROUTES = {
  admin: "/admin",
  doctor: "/dashboard",
  nurse: "/dashboard",
  patient: "/patient/home",
};

/**
 * Root redirect — sends authenticated users to their role-specific page.
 */
const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const target = ROLE_ROUTES[user?.role] || "/dashboard";
  return <Navigate to={target} replace />;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Authenticated patient route */}
            <Route
              path="/patient/home"
              element={
                <ProtectedRoute allowedRoles={["patient"]}>
                  <PatientHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/check-in"
              element={<ProtectedRoute allowedRoles={["patient"]}><PatientCheckIn /></ProtectedRoute>}
            />
            <Route
              path="/patient/plan"
              element={<ProtectedRoute allowedRoles={["patient"]}><RecoveryPlan /></ProtectedRoute>}
            />
            <Route
              path="/patient/ai-companion"
              element={<ProtectedRoute allowedRoles={["patient"]}><AICompanion /></ProtectedRoute>}
            />
            <Route
              path="/patient/messages"
              element={<ProtectedRoute allowedRoles={["patient"]}><Messages /></ProtectedRoute>}
            />
            <Route
              path="/patient/timeline"
              element={<ProtectedRoute allowedRoles={["patient"]}><Timeline /></ProtectedRoute>}
            />

            {/* Authenticated layout with sidebar */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["doctor", "nurse", "admin"]}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Nurse + Doctor Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Enroll Patient */}
              <Route path="/patients/enroll" element={<EnrollPatient />} />

              {/* Patient Detail */}
              <Route path="/patients/:id" element={<PatientDetail />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminPanel />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

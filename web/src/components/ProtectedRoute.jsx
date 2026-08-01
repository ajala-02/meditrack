import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_ROUTES = {
  admin: "/admin",
  doctor: "/dashboard",
  nurse: "/dashboard",
};

/**
 * Wraps a route to require authentication.
 * Optionally restrict to specific roles.
 *
 * @param {{ children: JSX.Element, allowedRoles?: string[] }} props
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "#0f172a" }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <svg className="animate-spin h-8 w-8" style={{ color: "#6366f1" }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm" style={{ color: "#94a3b8" }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the user's default page instead of showing 403
    const defaultRoute = ROLE_ROUTES[user.role] || "/dashboard";
    return <Navigate to={defaultRoute} replace />;
  }

  return children;
};

export default ProtectedRoute;

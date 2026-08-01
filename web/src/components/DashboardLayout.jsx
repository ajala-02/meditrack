import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

/**
 * Wraps all authenticated pages with the sidebar.
 * Children render inside the main content area (right of sidebar).
 */
const DashboardLayout = () => {
  return (
    <div className="min-h-screen" style={{ background: "#0f172a" }}>
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;

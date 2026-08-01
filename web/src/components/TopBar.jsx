import { useAuth } from "../context/AuthContext";
import useAlerts from "../hooks/useAlerts";

const TopBar = ({ title, subtitle }) => {
  const { user } = useAuth();
  const { pendingCount } = useAlerts();

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
      style={{
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #1e293b",
      }}
    >
      {/* Left: Title */}
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[#64748b] mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Connection indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e293b]">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-[#94a3b8]">Live</span>
        </div>

        {/* Alert bell */}
        <button
          id="alert-bell"
          className="relative p-2 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {pendingCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
              style={{
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)",
              }}
            >
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>

        {/* Role badge */}
        <div className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
             style={{
               background: "rgba(99, 102, 241, 0.12)",
               color: "#818cf8",
               border: "1px solid rgba(99, 102, 241, 0.25)",
             }}>
          {user?.role}
        </div>
      </div>
    </header>
  );
};

export default TopBar;

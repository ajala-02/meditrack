import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ROLE_ROUTES = {
  admin: "/admin",
  doctor: "/dashboard",
  nurse: "/dashboard",
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const user = await login(email, password);
      const redirectPath = ROLE_ROUTES[user.role] || "/dashboard";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0a0f1e] text-slate-100 overflow-x-hidden relative grid-pattern select-none">
      {/* Custom Styles Injection */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes ecg {
          to {
            stroke-dashoffset: -1000;
          }
        }
        @keyframes heart-pulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 4px rgba(6, 182, 212, 0.4));
          }
          50% {
            transform: scale(1.1);
            filter: drop-shadow(0 0 16px rgba(6, 182, 212, 0.8));
          }
        }
        .animate-blob {
          animation: blob 10s infinite ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animate-ecg {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: ecg 8s linear infinite;
        }
        .animate-heart {
          animation: heart-pulse 2s infinite ease-in-out;
          transform-origin: center;
        }
        .grid-pattern {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
        }
      `}</style>

      {/* Animated Gradient Blobs */}
      <div className="absolute top-10 left-10 w-[350px] h-[350px] rounded-full bg-[#06b6d4] opacity-[0.15] blur-[120px] animate-blob pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[400px] h-[400px] rounded-full bg-[#3b82f6] opacity-[0.15] blur-[130px] animate-blob animation-delay-2000 pointer-events-none" />

      {/* Left panel (60%) */}
      <div className="w-full lg:w-[60%] flex flex-col justify-center gap-6 p-8 lg:p-20 relative z-10 lg:min-h-screen">
        {/* Top: Logo, ECG & Tagline section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              {/* Heart icon */}
              <svg className="w-6 h-6 text-white animate-heart" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Medi<span className="text-[#06b6d4]">Track</span>
            </h1>
          </div>

          {/* Heartbeat/ECG line */}
          <div className="mt-1 opacity-80">
            <svg viewBox="0 0 400 60" className="w-full max-w-sm h-12 text-teal-400">
              <path
                d="M 10 30 L 100 30 L 110 15 L 120 45 L 130 30 L 170 30 L 175 20 L 180 40 L 185 30 L 230 30 L 240 5 L 250 55 L 260 30 L 310 30 L 320 20 L 330 40 L 340 30 L 390 30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-ecg"
              />
            </svg>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mt-1 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Intelligent Recovery. <br />
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] bg-clip-text text-transparent">Real-time Care.</span>
          </h2>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-col gap-4 max-w-lg mt-2">
          {/* Highlight 1 */}
          <div className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-[#06b6d4] bg-slate-900/40 backdrop-blur-md border border-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
            <div className="text-2xl filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">🩺</div>
            <div>
              <p className="text-base font-bold text-white leading-tight">Condition-Specific Monitoring</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Cardiac, Ortho, Diabetes & more</p>
            </div>
          </div>
          {/* Highlight 2 */}
          <div className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-[#06b6d4] bg-slate-900/40 backdrop-blur-md border border-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
            <div className="text-2xl filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">🧠</div>
            <div>
              <p className="text-base font-bold text-white leading-tight">AI-Assisted Triage</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">AI analyzes symptoms instantly</p>
            </div>
          </div>
          {/* Highlight 3 */}
          <div className="flex items-center gap-4 p-4 rounded-xl border-l-4 border-[#06b6d4] bg-slate-900/40 backdrop-blur-md border border-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
            <div className="text-2xl filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">🚨</div>
            <div>
              <p className="text-base font-bold text-white leading-tight">Real-time Alerts</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Nurses & doctors notified by severity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel (45% on lg, 40% on xl) */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center items-center p-6 sm:p-10 md:p-12 lg:p-16 relative z-10 lg:min-h-screen">
        <div className="w-full max-w-lg p-8 sm:p-10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-[20px] shadow-2xl relative overflow-hidden mx-auto">
          {/* Subtle shine overlay */}
          <div className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />

          {/* Heading */}
          <div className="relative mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl text-sm border animate-fade-in bg-rose-500/10 border-rose-500/20 text-rose-300">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="doctor@hospital.com"
                  className="w-full px-4 py-4 rounded-xl text-base text-white placeholder-slate-500 bg-slate-950/60 border border-slate-800/80 outline-none transition-all duration-300 focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 shadow-inner"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-4 pr-12 py-4 rounded-xl text-base text-white placeholder-slate-500 bg-slate-950/60 border border-slate-800/80 outline-none transition-all duration-300 focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 shadow-inner"
                />
                {/* Show/Hide Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none flex items-center p-1"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 5.656m0 0l-8.228 8.228m8.228-8.228a4 4 0 015.656-5.656m0 0l8.228 8.228M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button with top margin offset for clear separation */}
            <div className="pt-2">
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl text-base font-bold text-white transition-all duration-300 relative overflow-hidden group/btn bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Footer info */}
          <p className="text-center text-xs text-slate-500 mt-8 font-medium">
            MediTrack Clinical Platform • Secure Access
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

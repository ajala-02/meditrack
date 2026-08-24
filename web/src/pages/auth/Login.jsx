import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !recoveryCode.trim()) {
      setError("Enter your email address and recovery code to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), undefined, recoveryCode.trim());
      navigate(user.role === "patient" ? "/patient/home" : "/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "We could not sign you in. Please check your details and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-white">
      {/* <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1240px] overflow-hidden rounded-[32px] border border-[#dce7e1] bg-white shadow-[0_24px_70px_rgba(31,84,73,0.10)] lg:min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]"> */}
      <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden bg-[#1f6b62] px-7 py-8 text-white sm:px-11 sm:py-12 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
          <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full border-[42px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-28 left-20 h-72 w-72 rounded-full bg-[#e9ad7e]/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#1f6b62] shadow-lg shadow-black/10"><svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></div><span className="text-2xl font-extrabold tracking-tight">MediTrack</span></div>
            <div className="mt-16 max-w-[520px] lg:mt-24"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.14em] text-[#f5c49d]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5c49d]" /> POST-DISCHARGE CARE</div><h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[58px]">Recovery feels better with someone beside you.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#d7ebe3] sm:text-lg">A reassuring place to check in, follow your recovery plan, and stay connected to your care team after discharge.</p></div>
          </div>
          <div className="relative mt-auto grid grid-cols-3 gap-2 pt-6">
            {[["✓", "2-minute check-ins", "A small update keeps your team informed."], ["⌁", "Care that notices", "Symptoms are reviewed with your recovery plan."], ["↗", "Support when needed", "Your care team is only a message away."]].map(([icon, title, detail]) => <div key={title} className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.08] p-2.5 backdrop-blur-sm"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-bold">{icon}</div><p className="text-xs font-bold leading-tight">{title}</p><p className="text-[10px] leading-4 text-[#c9e0d8]">{detail}</p></div>)}
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#fdfdfb] px-6 py-10 sm:px-12 lg:px-14">
          <div className="w-full max-w-[420px]">
            <p className="text-xs font-extrabold tracking-[0.12em] text-[#b26c4b]">PATIENT PORTAL</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-[#183f38]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-[#6f827d]">Sign in to view today’s recovery plan and share how you are feeling.</p>
            {error && <div role="alert" className="mt-7 flex items-start gap-3 rounded-xl border border-[#f1cbc3] bg-[#fff3f1] p-3.5 text-sm text-[#9a493e]"><span className="font-bold">!</span>{error}</div>}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block"><span className="mb-2 block text-xs font-extrabold tracking-[0.08em] text-[#385a53]">EMAIL ADDRESS</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#78908a]">✉</span><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-14 w-full rounded-xl border border-[#d8e3de] bg-white pl-11 pr-4 text-[15px] text-[#244740] outline-none transition placeholder:text-[#9ba9a5] focus:border-[#2f8c7d] focus:ring-4 focus:ring-[#2f8c7d]/10" /></div></label>
              <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-extrabold tracking-[0.08em] text-[#385a53]">RECOVERY CODE <span className="normal-case font-medium tracking-normal text-[#84948f]">Shared by your hospital</span></span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#78908a]">⌘</span><input id="recovery-code" type="text" autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} placeholder="Enter your 6-digit code" maxLength={6} className="h-14 w-full rounded-xl border border-[#d8e3de] bg-white pl-11 pr-4 text-[15px] font-bold tracking-[0.14em] text-[#244740] outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9ba9a5] focus:border-[#2f8c7d] focus:ring-4 focus:ring-[#2f8c7d]/10" /></div></label>
              <button type="submit" disabled={isLoading} className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1f6b62] text-[15px] font-extrabold text-white shadow-lg shadow-[#1f6b62]/20 transition hover:bg-[#18564e] disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Signing you in…" : <>Continue to my recovery <span aria-hidden="true">→</span></>}</button>
            </form>
            <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-[#71837e]">🔒 Your recovery information is securely protected.</div><p className="mt-5 text-center text-sm text-[#71837e]">Need your recovery code? <a href="mailto:support@meditrack.com" className="font-bold text-[#1f6b62] underline underline-offset-2">Contact your hospital</a></p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;

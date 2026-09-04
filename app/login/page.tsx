"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock, User, ArrowRight, Activity, CheckCircle2, LifeBuoy } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal masuk ke sistem.");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F4F7FE] p-4 lg:p-8 font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-5xl rounded-[36px] bg-white shadow-xl border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* Left Hero / Branding Section */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#1B2559] via-[#111C44] to-[#0B132B] p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
          <div className="absolute -left-10 -top-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

          <div>
            <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 mb-8">
              <Activity size={16} className="text-blue-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide text-blue-200">DMO Operations</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-3 leading-tight">
              Operational Excellence & SLA Monitoring
            </h2>
            <p className="text-slate-300 text-xs leading-relaxed">
              Platform terpusat untuk pemantauan insiden layanan TI, analisis kepatuhan SLA, dan performa MTTR secara real-time.
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Analisis performa tiket otomatis</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>SLA Early Warning & Tracking</span>
            </div>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            
            <div className="mb-8 space-y-1.5">
              <h1 className="text-2xl font-bold text-[#1B2559] tracking-tight">
                Selamat Datang Kembali 👋
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Masukkan kredensial akun operasional Anda untuk melanjutkan.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-100 p-4 flex items-center gap-3 animate-shake">
                <ShieldAlert size={18} className="text-rose-500 shrink-0" />
                <p className="text-xs text-rose-600 font-bold">{error}</p>
              </div>
            )}

            {/* Form Login */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-3.5 text-sm text-[#1B2559] focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 focus:outline-none transition bg-slate-50/50 font-medium"
                    placeholder="Masukkan username..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-3.5 text-sm text-[#1B2559] focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 focus:outline-none transition bg-slate-50/50 font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#0052CC] py-3.5 text-sm font-bold text-white transition hover:bg-[#003B95] disabled:bg-blue-300 shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 mt-4 group cursor-pointer"
              >
                {loading ? (
                  "Memproses..."
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Info Lupa Password ala SOP Perusahaan (Bikin Tiket) */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-slate-400 text-xs">
              <LifeBuoy size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Kendala akses atau lupa password? Silakan buat tiket penanganan sistem ke <span className="font-semibold text-slate-600">Administrator IT</span>.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, FileText, BrainCircuit, LogOut, Clock, Calendar, KeyRound, X, ShieldAlert, CheckCircle } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface SidebarProps {
  activePage?: string;
}

export function Sidebar({ activePage }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentDateTime(new Date());
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", active: pathname === "/dashboard" || pathname === "/" },
    { icon: FileText, label: "Import Data", path: "/import-data", active: pathname === "/import-data" },
    { icon: BrainCircuit, label: "Prediksi SLA", path: "/dashboard/prediksi-sla", active: pathname === "/dashboard/prediksi-sla" },
  ];

  const handleLogout = async () => {

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Gagal logout.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout gagal:", error);
    }

  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage("Konfirmasi password baru tidak cocok!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal mengubah password.");

      setIsError(false);
      setMessage("Password berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setMessage("");
      }, 1500);
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = currentDateTime 
    ? currentDateTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Memuat...";

  const formattedTime = currentDateTime 
    ? currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " WIB"
    : "";

  return (
    <div className="relative z-30 shrink-0">
      <div className="w-[280px] bg-[#003B95] h-screen flex flex-col p-4 border-r border-[#002e75] justify-between">
        <div>
          <div className="flex items-center gap-3 px-3 py-6 mb-2">
            <div className="bg-white/10 h-10 w-10 rounded-xl flex items-center justify-center text-white font-extrabold text-2xl">
              T
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-white leading-tight">DMO Operational</span>
              <span className="text-[10px] text-blue-200 tracking-wider">Telekomunikasi Nasional</span>
            </div>
          </div>
          
          <nav className="space-y-1 mt-4">
            {menuItems.map((item) => (
              <div 
                key={item.label}
                onClick={() => router.push(item.path)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                  item.active 
                    ? "bg-white text-[#003B95] shadow-lg font-bold" 
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon size={20} />
                <span className="text-sm tracking-wide">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-1 text-blue-100">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Calendar size={13} className="text-blue-300" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Clock size={13} className="text-blue-300" />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="border-t border-blue-400/20 pt-3 space-y-1">
            <div 
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-3 px-4 py-2.5 text-blue-100 hover:bg-white/10 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <KeyRound size={18} />
              <span className="font-medium text-sm">Ubah Password</span>
            </div>

            <div 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 text-blue-100 hover:bg-red-500/10 hover:text-red-200 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut size={18} />
              <span className="font-medium text-sm">Logout</span>
            </div>
          </div>
        </div>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                  <KeyRound size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1B2559]">Ubah Password Manager</h3>
              </div>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium ${isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                {isError ? <ShieldAlert size={16} /> : <CheckCircle size={16} />}
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Password Lama</label>
                <input 
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#1B2559] focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 focus:outline-none transition bg-slate-50 font-medium"
                  placeholder="Masukkan password lama..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Password Baru</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#1B2559] focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 focus:outline-none transition bg-slate-50 font-medium"
                  placeholder="Masukkan password baru..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Konfirmasi Password Baru</label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#1B2559] focus:border-[#0052CC] focus:ring-2 focus:ring-blue-100 focus:outline-none transition bg-slate-50 font-medium"
                  placeholder="Ulangi password baru..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/2 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 rounded-xl bg-[#0052CC] py-3 text-sm font-bold text-white hover:bg-[#003B95] transition cursor-pointer disabled:bg-blue-300 shadow-sm shadow-blue-500/20"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

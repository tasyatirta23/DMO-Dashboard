"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { BrainCircuit, Loader2, BarChart3, CheckCircle2, AlertTriangle, FileText, Sparkles, Calendar, Upload } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"analisis" | "rules" | "prediksi">("analisis");
  
  // State untuk Periode Bulan & Upload
  const [selectedMonth, setSelectedMonth] = useState("2025-01");
  const [loadingModel, setLoadingModel] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // State hasil perhitungan ID3 & Master Data Unik dari Supabase
  const [rulesData, setRulesData] = useState<any[]>([]);
  const [attributeGainData, setAttributeGainData] = useState<any[]>([]);
  const [slaPieData, setSlaPieData] = useState<any[]>([]);
  const [modelAccuracy, setModelAccuracy] = useState("0%");
  
  const [uniqueSymptoms, setUniqueSymptoms] = useState<string[]>([]);
  const [uniqueProducts, setUniqueProducts] = useState<string[]>([]);
  const [uniquePriorities, setUniquePriorities] = useState<string[]>([]);
  const [uniqueAssignees, setUniqueAssignees] = useState<string[]>([]);

  // State untuk Prediksi ID3
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [matchedRuleId, setMatchedRuleId] = useState<number | null>(null);

  // State untuk Gemini AI CoT Insight
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // Form State
  const [symptom, setSymptom] = useState("");
  const [productName, setProductName] = useState("");
  const [priority, setPriority] = useState("");
  const [assigneeGroup, setAssigneeGroup] = useState("");

  useEffect(() => {
    fetchDynamicID3Model(selectedMonth);
  }, [selectedMonth]);

  const fetchDynamicID3Model = async (month: string) => {
    setLoadingModel(true);
    try {
      const response = await fetch(`/api/calculate-id3?month=${month}`);
      const data = await response.json();
      
      setRulesData(data.rules || []);
      setAttributeGainData(data.attributeGains || []);
      setSlaPieData(data.pieData || []);
      setModelAccuracy(data.accuracy || "0%");

      // Set opsi dropdown master data unik dari API
      const symList = data.uniqueSymptoms || [];
      const prodList = data.uniqueProducts || [];
      const prioList = data.uniquePriorities || [];
      const asgList = data.uniqueAssignees || [];

      setUniqueSymptoms(symList);
      setUniqueProducts(prodList);
      setUniquePriorities(prioList);
      setUniqueAssignees(asgList);

      // Otomatis set nilai default form ke elemen pertama jika ada
      if (symList.length > 0) setSymptom(symList[0]);
      if (prodList.length > 0) setProductName(prodList[0]);
      if (prioList.length > 0) setPriority(prioList[0]);
      if (asgList.length > 0) setAssigneeGroup(asgList[0]);

    } catch (error) {
      console.error("Gagal memuat model ID3 dinamis:", error);
    } finally {
      setLoadingModel(false);
    }
  };

  // Fungsi Handler Upload CSV Data Baru ke Supabase (Sudah Diperbaiki)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("month", selectedMonth);

    try {
      const res = await fetch("/api/upload-incidents", {
        method: "POST",
        body: formData,
      });

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        throw new Error(responseText || "Terjadi kesalahan pada server (bukan format JSON).");
      }

      if (res.ok && data.success) {
        alert("Data berhasil diunggah dan pohon keputusan berhasil digenerate ulang!");
        setIsUploadModalOpen(false);
        setUploadFile(null);
        fetchDynamicID3Model(selectedMonth); // Refresh data
      } else {
        alert("Gagal mengunggah data: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan saat upload data: " + (err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setAiInsight(null);

    try {
      // Panggil backend API dengan action predict untuk hasil yang akurat sesuai pohon keputusan
      const res = await fetch(`/api/calculate-id3?month=${selectedMonth}&action=predict&symptom=${encodeURIComponent(symptom)}&productName=${encodeURIComponent(productName)}&priority=${encodeURIComponent(priority)}&assigneeGroup=${encodeURIComponent(assigneeGroup)}`);
      const data = await res.json();

      const matchedResult = data.prediction || "ACHIEVED";
      const foundId = data.matchedRuleId || null;

      setResult(matchedResult);
      setMatchedRuleId(foundId);
      setLoading(false);

      await fetchAIAnalysis(matchedResult, symptom, productName, priority, assigneeGroup);
    } catch (error) {
      console.error("Gagal memproses prediksi:", error);
      setLoading(false);
    }
  };

  const fetchAIAnalysis = async (pred: string, sym: string, prod: string, prio: string, group: string) => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/analyze-sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction: pred, symptom: sym, productName: prod, priority: prio, assigneeGroup: group })
      });
      const data = await response.json();
      setAiInsight(data.insight);
    } catch (error) {
      console.error("Gagal mengambil insight AI:", error);
      setAiInsight("Gagal memuat analisis AI.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F4F7FE] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activePage="Analisis & Prediksi SLA" />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto p-8 gap-6">
        {/* Header, Filter Bulan, Upload Button & Navigation Tabs */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-[#1B2559]">Analisis & Prediksi SLA (Algoritma ID3 Dinamis)</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Sistem Klasifikasi Pohon Keputusan Berbasis Data Bulanan Supabase.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Tombol Upload Data Baru */}
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 bg-[#003B95] hover:bg-indigo-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Upload size={14} /> Upload Data Bulanan
            </button>

            {/* Dropdown Filter Periode Bulan */}
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
              <Calendar size={15} className="text-[#003B95]" />
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold text-[#1B2559] outline-none bg-transparent cursor-pointer"
              >
                <optgroup label="Tahun 2025">
                  <option value="2025-01">Januari 2025</option>
                  <option value="2025-02">Februari 2025</option>
                  <option value="2025-03">Maret 2025</option>
                  <option value="2025-04">April 2025</option>
                  <option value="2025-05">Mei 2025</option>
                  <option value="2025-06">Juni 2025</option>
                  <option value="2025-07">Juli 2025</option>
                  <option value="2025-08">Agustus 2025</option>
                  <option value="2025-09">September 2025</option>
                  <option value="2025-10">Oktober 2025</option>
                  <option value="2025-11">November 2025</option>
                  <option value="2025-12">Desember 2025</option>
                </optgroup>
                <optgroup label="Tahun 2026">
                  <option value="2026-01">Januari 2026</option>
                  <option value="2026-02">Februari 2026</option>
                  <option value="2026-03">Maret 2026</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-05">Mei 2026</option>
                  <option value="2026-06">Juni 2026</option>
                </optgroup>
              </select>
            </div>

            {/* Tab Menu Navigation */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button onClick={() => setActiveTab("analisis")} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'analisis' ? 'bg-[#003B95] text-white shadow-xs' : 'text-slate-600 hover:text-[#1B2559]'}`}>
                <BarChart3 size={13} /> Analisis
              </button>
              <button onClick={() => setActiveTab("rules")} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'rules' ? 'bg-[#003B95] text-white shadow-xs' : 'text-slate-600 hover:text-[#1B2559]'}`}>
                <FileText size={13} /> Rules
              </button>
              <button onClick={() => setActiveTab("prediksi")} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'prediksi' ? 'bg-[#003B95] text-white shadow-xs' : 'text-slate-600 hover:text-[#1B2559]'}`}>
                <BrainCircuit size={13} /> Prediksi
              </button>
            </div>
          </div>
        </div>

        {/* Modal Upload Data */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-[24px] max-w-md w-full shadow-xl space-y-4">
              <h3 className="text-base font-bold text-[#1B2559]">Upload Dataset Insiden Bulanan</h3>
              <p className="text-xs text-slate-500">Pilih file CSV/Excel data insiden untuk periode {selectedMonth}. Sistem akan otomatis memperbarui database Supabase & menghitung ulang pohon keputusan ID3.</p>
              
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <input 
                  type="file" 
                  accept=".csv, .xlsx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#003B95] hover:file:bg-blue-100 cursor-pointer"
                  required
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                  <button type="submit" disabled={uploading} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#003B95] text-white flex items-center gap-2">
                    {uploading && <Loader2 className="animate-spin" size={14} />}
                    {uploading ? "Memproses..." : "Upload & Generate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loadingModel ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
            <Loader2 className="animate-spin text-[#003B95]" size={36} />
            <p className="text-xs font-bold text-slate-500">Menarik data dari Supabase & menghitung ulang Information Gain untuk periode {selectedMonth}...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: ANALISIS ATRIBUT */}
            {activeTab === "analisis" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#1B2559] mb-1">Information Gain per Atribut (Periode {selectedMonth})</h2>
                    <p className="text-xs text-slate-500 mb-2">Nilai gain dihitung otomatis dari data bulan terpilih.</p>
                  </div>
                  <div className="w-full h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attributeGainData} maxBarSize={70} margin={{ top: 15, right: 40, left: 20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="attribute" tick={{ fontSize: 10, fontWeight: 600 }} interval={0} angle={-10} textAnchor="end" />
                        <YAxis domain={[0, 0.1]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="gain" fill="#003B95" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#1B2559] mb-1">Distribusi Outcome SLA (Periode {selectedMonth})</h2>
                    <p className="text-xs text-slate-500 mb-2">Proporsi status insiden pada bulan ini.</p>
                  </div>
                  <div className="flex items-center justify-center h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={slaPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={4} cornerRadius={4} label>
                          {slaPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RULE EXTRACTION */}
            {activeTab === "rules" && (
              <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-[#1B2559]">Ekstraksi Aturan IF-THEN (Periode {selectedMonth})</h2>
                  <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">Akurasi Model: {modelAccuracy}</span>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold sticky top-0">
                      <tr><th className="p-3">No</th><th className="p-3">Symptom</th><th className="p-3">Product</th><th className="p-3">Priority</th><th className="p-3">Assignee Group</th><th className="p-3">Outcome</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rulesData.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-6 text-slate-400">Belum ada data pada periode ini. Silakan upload data CSV.</td></tr>
                      ) : (
                        rulesData.map((rule: any) => (
                          <tr key={rule.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-bold text-slate-500">#{rule.id}</td>
                            <td className="p-3 font-medium">{rule.symptom || "-"}</td>
                            <td className="p-3">{rule.productName || "-"}</td>
                            <td className="p-3">{rule.priority || "-"}</td>
                            <td className="p-3 text-slate-700">{rule.assigneeGroup || "-"}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-lg font-bold ${rule.prediction === 'MISSED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{rule.prediction}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: PREDIKSI TIKET & AI REFINEMENT */}
            {activeTab === "prediksi" && (
              <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm">
                <h2 className="text-sm font-bold text-[#1B2559] mb-4">Form Simulasi Prediksi Status SLA (Berdasarkan Model Bulan {selectedMonth})</h2>
                <form onSubmit={handlePredict} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Dropdown Symptom Dinamis */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Symptom</label>
                      <select value={symptom} onChange={(e) => setSymptom(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#1B2559] outline-none cursor-pointer">
                        {uniqueSymptoms.map((sym, idx) => (
                          <option key={idx} value={sym}>{sym}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown Product Name Dinamis */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Product Name</label>
                      <select value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#1B2559] outline-none cursor-pointer">
                        {uniqueProducts.map((prod, idx) => (
                          <option key={idx} value={prod}>{prod}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown Priority Dinamis */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Priority</label>
                      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#1B2559] outline-none cursor-pointer">
                        {uniquePriorities.map((prio, idx) => (
                          <option key={idx} value={prio}>{prio}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown Assignee Group Dinamis */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Assignee Group</label>
                      <select value={assigneeGroup} onChange={(e) => setAssigneeGroup(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#1B2559] outline-none cursor-pointer">
                        {uniqueAssignees.map((asg, idx) => (
                          <option key={idx} value={asg}>{asg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-[#003B95] hover:bg-indigo-900 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-4">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                    {loading ? "Memproses Model ID3 Dinamis..." : "Prediksi Status SLA"}
                  </button>
                </form>

                {result && (
                  <div className={`mt-6 p-6 rounded-2xl border flex flex-col gap-4 ${result === 'MISSED' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <div className="flex items-center gap-3">
                      {result === 'MISSED' ? <AlertTriangle size={24} className="text-rose-600" /> : <CheckCircle2 size={24} className="text-emerald-600" />}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">Hasil Klasifikasi ID3 (Bulan {selectedMonth}):</span>
                        <span className="text-xl font-extrabold">Status: {result}</span>
                        {matchedRuleId && <span className="text-xs block mt-1 font-semibold opacity-80">Berdasarkan Rule ID: #{matchedRuleId}</span>}
                      </div>
                    </div>

                    {/* AI CoT Insight */}
                    <div className="bg-white/95 backdrop-blur-sm p-5 rounded-xl border border-slate-200 text-slate-700 mt-2 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 font-bold text-xs text-[#1B2559] pb-3 border-b border-slate-100">
                        <Sparkles size={16} className="text-amber-500" />
                        <span>Chain-of-Thought (CoT) AI Analysis & Rekomendasi Mitigasi</span>
                      </div>

                      {aiLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-8 justify-center">
                          <Loader2 className="animate-spin" size={16} /> Gemini sedang menyusun analisis bertahap...
                        </div>
                      ) : (
                        <div className="space-y-3.5 text-xs">
                          {(() => {
                            const text = aiInsight || "";
                            const part1 = text.split(/2\.\s*Akar\s*Masalah/i)[0]?.replace(/1\.\s*Evaluasi[^\n]*/i, "").replace(/[*#]/g, "").trim() || "Memuat evaluasi...";
                            const afterPart1 = text.split(/2\.\s*Akar\s*Masalah/i)[1] || "";
                            const part2 = afterPart1.split(/3\.\s*Rekomendasi/i)[0]?.replace(/^[:\s]*/, "").replace(/[*#]/g, "").trim() || "Memuat akar masalah...";
                            const part3 = afterPart1.split(/3\.\s*Rekomendasi/i)[1]?.replace(/^[:\s]*/, "").replace(/[*#]/g, "").trim() || text.replace(/[*#]/g, "").trim();

                            return (
                              <>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 shadow-2xs">
                                  <div className="font-bold text-[#1B2559] flex items-center gap-2 mb-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    <span>1. Evaluasi Kombinasi Atribut</span>
                                  </div>
                                  <p className="text-slate-600 leading-relaxed pl-4 border-l-2 border-blue-200 whitespace-pre-line">{part1}</p>
                                </div>

                                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 shadow-2xs">
                                  <div className="font-bold text-amber-900 flex items-center gap-2 mb-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>2. Akar Masalah & Potensi Bottleneck</span>
                                  </div>
                                  <div className="text-slate-700 leading-relaxed pl-4 border-l-2 border-amber-300 space-y-1.5">
                                    {part2.split("\n").map(line => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean).map((cleanLine, idx) => (
                                      <div key={idx} className="flex items-start gap-2">
                                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                                        <span className="flex-1">{cleanLine}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/60 shadow-2xs">
                                  <div className="font-bold text-emerald-900 flex items-center gap-2 mb-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    <span>3. Rekomendasi Mitigasi Taktis Operasional</span>
                                  </div>
                                  <div className="text-slate-700 leading-relaxed pl-4 border-l-2 border-emerald-300 space-y-1.5">
                                    {part3.split("\n").map(line => line.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean).map((cleanLine, idx) => (
                                      <div key={idx} className="flex items-start gap-2">
                                        <span className="text-emerald-700 font-bold min-w-[16px]">{idx + 1}.</span>
                                        <span className="flex-1">{cleanLine}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
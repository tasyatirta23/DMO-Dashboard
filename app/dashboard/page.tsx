"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import IncidentCharts from "@/components/IncidentCharts"; 
import ProductDistributionChart from "@/components/ProductDistributionChart"; 
import { createClient } from "@supabase/supabase-js";
import { Loader2, CheckCircle2, BarChart3, BellRing, X, Calendar, Search, TrendingUp, TrendingDown, Download, ShieldAlert, Check } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  const [totalIncidents, setTotalIncidents] = useState<number>(0);
  const [breachedCount, setBreachedCount] = useState<number>(0);
  const [achievedCount, setAchievedCount] = useState<number>(0);
  const [breachedRate, setBreachedRate] = useState<string>("0.0");
  const [mttrHours, setMttrHours] = useState<string>("0.0");
  const [warningCount, setWarningCount] = useState<number>(0);
  const [warningTickets, setWarningTickets] = useState<any[]>([]);
  const [allFilteredTickets, setAllFilteredTickets] = useState<any[]>([]);
  
  const [assigneeSlaBreakdown, setAssigneeSlaBreakdown] = useState<{ [group: string]: { achieved: number; missed: number; total: number } }>({});
  const [topSymptoms, setTopSymptoms] = useState<{ symptom: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ productName: string; count: number }[]>([]);
  
  const [monthComparison, setMonthComparison] = useState<{ percentage: string; isIncrease: boolean }>({ percentage: "0.0", isIncrease: true });
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState<boolean>(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState<boolean>(false); 
  const [loading, setLoading] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  
  const [availableYears, setAvailableYears] = useState<string[]>(["2026", "2025"]);
  
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("09");
  const [selectedDay, setSelectedDay] = useState<string>("03");

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchAllIncidents = async () => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let fetched = true;

    while (fetched) {
      const { data, error } = await supabase
        .from("Incident")
        .select("ticketNumber, productName, createdDate, resolvedDate, targetSlaHours, status, slaStatus, slaStatusModel, symptom, assigneeGroup, solver, picSolver")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("Error fetching batch:", error);
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          fetched = false;
        } else {
          page++;
        }
      } else {
        fetched = false;
      }
    }
    return allData;
  };

  useEffect(() => {
    const initYears = async () => {
      try {
        const rawData = await fetchAllIncidents();
        const yearSet = new Set<string>();
        rawData.forEach((item) => {
          if (item.createdDate) {
            const yearStr = item.createdDate.toString().substring(0, 4);
            if (yearStr.length === 4 && !isNaN(Number(yearStr))) {
              yearSet.add(yearStr);
            }
          }
        });
        const sortedYears = Array.from(yearSet).sort().reverse();
        if (sortedYears.length > 0) {
          setAvailableYears(sortedYears);
        }
      } catch (err) {
        console.error("Gagal memuat daftar tahun:", err);
      }
    };

    initYears();
  }, []);

  useEffect(() => {
    const processDashboardData = async () => {
      try {
        setLoading(true);
        const rawData = await fetchAllIncidents();

        const filteredData = rawData.filter((item) => {
          if (!item.createdDate) return false;
          const itemDateStr = item.createdDate.toString();
          const itemYear = itemDateStr.substring(0, 4);
          const itemMonth = itemDateStr.substring(5, 7);
          const itemDay = itemDateStr.substring(8, 10);

          const matchYear = selectedYear === "ALL" || itemYear === selectedYear;
          const matchMonth = selectedMonth === "ALL" || itemMonth === selectedMonth;
          const matchDay = selectedDay === "ALL" || itemDay === selectedDay;

          return matchYear && matchMonth && matchDay;
        });

        if (selectedYear !== "ALL" && selectedMonth !== "ALL") {
          const currentYearNum = parseInt(selectedYear);
          const currentMonthNum = parseInt(selectedMonth);
          
          let prevMonthNum = currentMonthNum - 1;
          let prevYearNum = currentYearNum;
          if (prevMonthNum === 0) {
            prevMonthNum = 12;
            prevYearNum = currentYearNum - 1;
          }
          const prevMonthStr = prevMonthNum < 10 ? `0${prevMonthNum}` : `${prevMonthNum}`;
          const prevYearStr = `${prevYearNum}`;

          const prevMonthData = rawData.filter((item) => {
            if (!item.createdDate) return false;
            const itemDateStr = item.createdDate.toString();
            return itemDateStr.substring(0, 4) === prevYearStr && itemDateStr.substring(5, 7) === prevMonthStr;
          });

          const currentCount = filteredData.length;
          const prevCount = prevMonthData.length;

          if (prevCount > 0) {
            const diff = ((currentCount - prevCount) / prevCount) * 100;
            setMonthComparison({
              percentage: Math.abs(diff).toFixed(1),
              isIncrease: diff > 0
            });
          } else {
            setMonthComparison({ percentage: "0.0", isIncrease: false });
          }
        } else {
          setMonthComparison({ percentage: "0.0", isIncrease: false });
        }

        let totalCount = filteredData.length;
        let breachCount = 0;
        let totalDurationHours = 0;
        let resolvedCount = 0;
        let activeWarningCount = 0;
        const activeWarningList: any[] = [];
        const groupBreakdown: { [group: string]: { achieved: number; missed: number; total: number } } = {};
        
        const symptomMap: { [key: string]: number } = {};
        const productMap: { [key: string]: number } = {};

        const now = new Date().getTime();

        filteredData.forEach((item) => {
          const slaStatusLower = (item.slaStatus || "").toLowerCase();
          const slaStatusModelLower = (item.slaStatusModel || "").toLowerCase();
          const groupName = item.assigneeGroup || "Unassigned";
          const symptomName = item.symptom || "Tidak ada keterangan";
          const productName = item.productName || "Lainnya";

          productMap[productName] = (productMap[productName] || 0) + 1;
          symptomMap[symptomName] = (symptomMap[symptomName] || 0) + 1;

          if (!groupBreakdown[groupName]) {
            groupBreakdown[groupName] = { achieved: 0, missed: 0, total: 0 };
          }
          groupBreakdown[groupName].total++;
          
          const isDbBreached = 
            slaStatusLower.includes("breached") || 
            slaStatusLower.includes("missed") || 
            slaStatusModelLower.includes("breached") || 
            slaStatusModelLower.includes("missed");

          const statusLower = (item.status || "").toLowerCase();
          const isOpen = !statusLower.includes("close") && !statusLower.includes("resolve");

          let isTimeBreached = false;
          let percentageUsed = 0;

          if (item.createdDate && item.targetSlaHours) {
            const createdTime = new Date(item.createdDate).getTime();
            const targetHours = Number(item.targetSlaHours);

            if (!isNaN(createdTime) && !isNaN(targetHours) && targetHours > 0) {
              const elapsedHours = (now - createdTime) / (1000 * 60 * 60);
              percentageUsed = (elapsedHours / targetHours) * 100;

              if (isOpen && percentageUsed >= 100) {
                isTimeBreached = true;
              }

              if (isOpen && percentageUsed >= 80) {
                activeWarningCount++;
                activeWarningList.push({
                  ...item,
                  percentageUsed: percentageUsed.toFixed(1),
                  remainingHours: Math.max(0, targetHours - elapsedHours).toFixed(1)
                });
              }
            }
          }

          const finalIsMissed = isDbBreached || isTimeBreached;

          if (finalIsMissed) {
            breachCount++;
            groupBreakdown[groupName].missed++;
          } else {
            groupBreakdown[groupName].achieved++;
          }

          if (item.createdDate && item.resolvedDate) {
            const start = new Date(item.createdDate).getTime();
            const end = new Date(item.resolvedDate).getTime();

            if (!isNaN(start) && !isNaN(end) && end >= start) {
              const diffHours = (end - start) / (1000 * 60 * 60);
              totalDurationHours += diffHours;
              resolvedCount++;
            }
          }
        });

        const formattedSymptoms = Object.entries(symptomMap).map(([sym, count]) => ({
          symptom: sym,
          count: count
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        const formattedProducts = Object.entries(productMap).map(([prod, count]) => ({
          productName: prod,
          count: count
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        const mttr = resolvedCount > 0 ? (totalDurationHours / resolvedCount).toFixed(1) : "0.0";
        const rate = totalCount > 0 ? ((breachCount / totalCount) * 100).toFixed(1) : "0.0";
        const calculatedAchievedCount = Math.max(0, totalCount - breachCount);

        setTotalIncidents(totalCount);
        setBreachedCount(breachCount);
        setAchievedCount(calculatedAchievedCount);
        setBreachedRate(rate);
        setMttrHours(mttr);
        setWarningCount(activeWarningCount);
        setWarningTickets(activeWarningList);
        setAllFilteredTickets(filteredData);
        setAssigneeSlaBreakdown(groupBreakdown);
        setTopSymptoms(formattedSymptoms);
        setTopProducts(formattedProducts);

      } catch (error: any) {
        console.error("Gagal memproses data dashboard:", error?.message || JSON.stringify(error));
      } finally {
        setLoading(false);
      }
    };

    processDashboardData();
  }, [selectedYear, selectedMonth, selectedDay]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      const parentContainer = element.parentElement;
      
      if (parentContainer) parentContainer.style.display = "block";

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      if (parentContainer) parentContainer.style.display = "none";

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = Number(((canvas.height * pdfWidth) / canvas.width).toFixed(2));

      pdf.addImage(imgData, "JPEG", 0, 0, Number(pdfWidth), Number(pdfHeight));
      pdf.save(`Laporan-Operasional-DMO-${selectedYear}-${selectedMonth}-${selectedDay}.pdf`);
    } catch (error) {
      console.error("Gagal generate PDF:", error);
      if (reportRef.current?.parentElement) {
        reportRef.current.parentElement.style.display = "none";
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadSlaCSV = () => {
    const groups = Object.entries(assigneeSlaBreakdown);
    if (groups.length === 0) return;

    const headers = ["Assignee Group", "Total Tiket", "Achieved", "Missed", "Compliance Rate"];
    const rows = groups.map(([group, data]) => {
      const rateGroup = data.total > 0 ? ((data.achieved / data.total) * 100).toFixed(1) : "0.0";
      return [`"${group}"`, data.total, data.achieved, data.missed, `"${rateGroup}%"`];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SLA_Compliance_Assignee_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const searchedTickets = allFilteredTickets.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.ticketNumber || "").toLowerCase().includes(q) ||
      (item.productName || "").toLowerCase().includes(q) ||
      (item.symptom || "").toLowerCase().includes(q) ||
      (item.solver || "").toLowerCase().includes(q) ||
      (item.picSolver || "").toLowerCase().includes(q)
    );
  });

  const achievedRate = totalIncidents > 0 ? (100 - Number(breachedRate)).toFixed(1) : "0.0";

  const monthsList = [
    { value: "01", label: "Januari" }, { value: "02", label: "Februari" },
    { value: "03", label: "Maret" }, { value: "04", label: "April" },
    { value: "05", label: "Mei" }, { value: "06", label: "Juni" },
    { value: "07", label: "Juli" }, { value: "08", label: "Agustus" },
    { value: "09", label: "September" }, { value: "10", label: "Oktober" },
    { value: "11", label: "November" }, { value: "12", label: "Desember" },
  ];

  const daysList = Array.from({ length: 31 }, (_, i) => {
    const dayNum = i + 1;
    return { value: dayNum < 10 ? `0${dayNum}` : `${dayNum}`, label: `${dayNum}` };
  });

  const getActiveFilterLabel = () => {
    const dLabel = selectedDay === "ALL" ? "Semua Hari" : `Tanggal ${selectedDay}`;
    const mLabel = selectedMonth === "ALL" ? "Semua Bulan" : monthsList.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const yLabel = selectedYear === "ALL" ? "Semua Tahun" : selectedYear;
    return `${dLabel}, ${mLabel} ${yLabel}`;
  };

  return (
    <div className="flex h-screen w-full bg-[#F4F7FE] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activePage="Dashboard" />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto p-8 gap-6 relative">
        
        {/* HEADER & FILTER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2559] tracking-tight">
              DMO Operational Dashboard
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Monitoring Kepatuhan SLA & Kinerja MTTR Operasional Layanan TI secara Real-Time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500 mr-1">
                <Calendar size={16} className="text-blue-600" />
                <span className="text-xs font-semibold">Periode:</span>
              </div>

              <select 
                value={selectedDay} 
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-[#1B2559] px-2 py-1.5 rounded-xl outline-none cursor-pointer"
              >
                <option value="ALL">Hari (Semua)</option>
                {daysList.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>

              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-[#1B2559] px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
              >
                <option value="ALL">Bulan (Semua)</option>
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-[#1B2559] px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
              >
                <option value="ALL">Tahun (Semua)</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 bg-[#0052CC] hover:bg-[#003B95] text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              <span>{isGeneratingPdf ? "Memproses PDF..." : "Unduh Laporan (PDF)"}</span>
            </button>
          </div>
        </div>

        {/* SECTION 1 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              RINGKASAN OPERASIONAL & KEPATUHAN SLA ({getActiveFilterLabel().toUpperCase()})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Update Terakhir: Kamis, 3 September 2026</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div 
              onClick={() => setIsIncidentModalOpen(true)}
              className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between transition-all cursor-pointer hover:border-blue-300 hover:shadow-md group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Incidents</p>
                <div className="bg-blue-50 p-2.5 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                  <BarChart3 size={20} />
                </div>
              </div>
              
              <div className="my-5 flex items-baseline gap-3">
                <h3 className="text-3xl font-extrabold text-[#1B2559]">
                  {loading ? <Loader2 className="animate-spin text-blue-600 inline" size={24} /> : totalIncidents.toLocaleString()}
                </h3>
                
                {!loading && selectedMonth !== "ALL" && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    Number(monthComparison.percentage) === 0 ? 'bg-slate-100 text-slate-600' : monthComparison.isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {Number(monthComparison.percentage) === 0 ? null : monthComparison.isIncrease ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {monthComparison.percentage}% vs bln lalu
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Data tervalidasi sistem
                </span>
                <span className="text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Lihat &rarr;</span>
              </div>
            </div>

            <div 
              onClick={() => setIsSlaModalOpen(true)}
              className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm w-full flex flex-col justify-between transition-all cursor-pointer hover:border-emerald-300 hover:shadow-md group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    SLA Compliance & MTTR
                  </span>
                  <div className="bg-emerald-50 p-2.5 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={20} />
                  </div>
                </div>

                <div className="my-5 flex items-baseline gap-2">
                  <h3 className="text-3xl font-extrabold text-[#1B2559]">
                    {loading ? <Loader2 className="animate-spin text-emerald-600 inline" size={24} /> : totalIncidents === 0 ? "0.0%" : `${achievedRate}%`}
                  </h3>
                  {!loading && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${totalIncidents === 0 ? 'bg-slate-100 text-slate-500' : 'text-emerald-600 bg-emerald-50'}`}>
                      {totalIncidents === 0 ? "No Data" : "Achieved"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1B2559]">
                    {loading ? "..." : mttrHours}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Hours • Rata-rata MTTR
                  </span>
                </div>
                <span className="text-emerald-600 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">Detail SLA &rarr;</span>
              </div>
            </div>

            <div 
              onClick={() => warningCount > 0 && setIsModalOpen(true)}
              className={`bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between transition-all ${warningCount > 0 ? 'cursor-pointer hover:border-rose-300 hover:shadow-md group' : ''}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SLA Early Warning & Critical</p>
                <div className="bg-rose-50 p-2.5 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
                  <BellRing size={20} />
                </div>
              </div>
              <div className="my-5 flex items-baseline gap-2">
                <h3 className="text-3xl font-extrabold text-[#1B2559]">
                  {loading ? <Loader2 className="animate-spin text-rose-600 inline" size={24} /> : warningCount}
                </h3>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Mendekati / Melewati SLA (80%)
                </span>
                {warningCount > 0 && <span className="text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Lihat &rarr;</span>}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 */}
        <section className="flex flex-col gap-3 pb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ANALISIS TREN & DISTRIBUSI TAHUNAN ({selectedYear === "ALL" ? "SEMUA TAHUN" : `TAHUN ${selectedYear}`})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Data akumulatif per tahun</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 items-stretch gap-6 w-full">
            <IncidentCharts selectedYear={selectedYear} />
            <ProductDistributionChart selectedYear={selectedYear} />
          </div>
        </section>

      </main>

      {/* MODAL SLA DETAILS */}
      {isSlaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-600">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1B2559]">Detail Analisis SLA Compliance & Assignee Group</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Rincian performa penyelesaian tiket berdasarkan status pencapaian.</p>
                </div>
              </div>
              <button onClick={() => setIsSlaModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4">
                  <div className="bg-emerald-500 text-white p-3 rounded-xl"><Check size={24} /></div>
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Achieved</span>
                    <h4 className="text-2xl font-extrabold text-emerald-900">{achievedCount.toLocaleString()} <span className="text-xs font-medium">tiket</span></h4>
                  </div>
                </div>

                <div className="bg-rose-50/60 border border-rose-100 p-5 rounded-2xl flex items-center gap-4">
                  <div className="bg-rose-500 text-white p-3 rounded-xl"><ShieldAlert size={24} /></div>
                  <div>
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Missed / Breached</span>
                    <h4 className="text-2xl font-extrabold text-rose-900">{breachedCount.toLocaleString()} <span className="text-xs font-medium">tiket</span></h4>
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 p-5 rounded-2xl flex items-center gap-4">
                  <div className="bg-blue-600 text-white p-3 rounded-xl"><BarChart3 size={24} /></div>
                  <div>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Compliance Rate</span>
                    <h4 className="text-2xl font-extrabold text-blue-900">{totalIncidents === 0 ? "0.0%" : `${achievedRate}%`}</h4>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#1B2559]">Distribusi SLA Berdasarkan Assignee Group</h3>
                  <button onClick={handleDownloadSlaCSV} className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border border-emerald-200">
                    <Download size={14} /> Download CSV
                  </button>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                        <th className="p-4">Assignee Group</th>
                        <th className="p-4 text-center">Total Tiket</th>
                        <th className="p-4 text-center">Achieved</th>
                        <th className="p-4 text-center">Missed</th>
                        <th className="p-4 text-right">Tingkat Kepatuhan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {Object.entries(assigneeSlaBreakdown).map(([group, data], idx) => {
                        const rateGroup = data.total > 0 ? ((data.achieved / data.total) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/85 transition-colors">
                            <td className="p-4 font-bold text-[#1B2559]">{group}</td>
                            <td className="p-4 text-center font-semibold">{data.total.toLocaleString()}</td>
                            <td className="p-4 text-center"><span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">{data.achieved}</span></td>
                            <td className="p-4 text-center"><span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700">{data.missed}</span></td>
                            <td className="p-4 text-right"><span className={`font-extrabold ${Number(rateGroup) >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{rateGroup}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button onClick={() => setIsSlaModalOpen(false)} className="bg-[#1B2559] hover:bg-indigo-900 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE PDF */}
      <div style={{ display: "none" }}>
        <div ref={reportRef} style={{ padding: "30px", background: "#ffffff", color: "#334155", fontFamily: "sans-serif", fontSize: "12px", width: "210mm", margin: "0 auto" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#1B2559" }}>Laporan Resmi Kinerja Operasional TI</h2>
          <p style={{ fontSize: "11px", color: "#64748b" }}>Periode - {getActiveFilterLabel()}</p>
          <p>Total Insiden: {totalIncidents} | SLA Compliance: {totalIncidents === 0 ? "0.0%" : `${achievedRate}%`} | MTTR: {mttrHours} Jam</p>
        </div>
      </div>

      {/* MODAL SELURUH TIKET */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-7xl rounded-[32px] shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-[#1B2559]">Daftar Seluruh Tiket Insiden</h2>
              <button onClick={() => setIsIncidentModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase">
                    <th className="p-3">Ticket No</th><th className="p-3">Product</th><th className="p-3">Created</th><th className="p-3">Status</th><th className="p-3">Symptom</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedTickets.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="p-3 font-bold text-blue-600">{item.ticketNumber}</td>
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3">{item.createdDate}</td>
                      <td className="p-3">{item.status}</td>
                      <td className="p-3">{item.symptom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EARLY WARNING */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-7xl rounded-[32px] shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-[#1B2559]">SLA Early Warning Tickets (≥80%)</h2>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase">
                    <th className="p-3">Ticket No</th><th className="p-3">Product</th><th className="p-3">SLA Used</th><th className="p-3">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {warningTickets.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="p-3 font-bold text-rose-600">{item.ticketNumber}</td>
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3 font-bold">{item.percentageUsed}%</td>
                      <td className="p-3">{item.remainingHours} Jam</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
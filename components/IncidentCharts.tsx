"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList 
} from "recharts";
import { Loader2, Activity } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface IncidentChartsProps {
  selectedYear: string;
}

export default function IncidentCharts({ selectedYear }: IncidentChartsProps) {
  const [symptomList, setSymptomList] = useState<string[]>([]);
  const [selectedSymptom, setSelectedSymptom] = useState<string>("Total Keseluruhan");
  const [lineData, setLineData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rawMatrix, setRawMatrix] = useState<{ [key: string]: number[] }>({});
  const [highestSpikeInfo, setHighestSpikeInfo] = useState<string>("");

  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        setLoading(true);

        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let fetchMore = true;

        while (fetchMore) {
          const { data, error } = await supabase
            .from("Incident")
            .select("symptom, createdDate")
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < pageSize) {
              fetchMore = false;
            } else {
              page++;
            }
          } else {
            fetchMore = false;
          }
        }

        if (allData && allData.length > 0) {
          const monthlyMatrix: { [key: string]: number[] } = {};
          const counts: { [key: string]: number } = {};
          const totalMatrix = Array(12).fill(0);

          allData.forEach((item) => {
            const symptom = item.symptom || "Lainnya";

            if (item.createdDate) {
              const dateObj = new Date(item.createdDate);
              const year = dateObj.getFullYear();
              const month = dateObj.getMonth() + 1;

              const matchesYear = selectedYear === "ALL" || year.toString() === selectedYear;

              if (matchesYear && !isNaN(month) && month >= 1 && month <= 12) {
                counts[symptom] = (counts[symptom] || 0) + 1;
                const monthIdx = month - 1; 
                
                if (!monthlyMatrix[symptom]) {
                  monthlyMatrix[symptom] = Array(12).fill(0);
                }
                monthlyMatrix[symptom][monthIdx]++;
                totalMatrix[monthIdx]++;
              }
            }
          });

          const sortedSymptoms = ["Total Keseluruhan", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
          monthlyMatrix["Total Keseluruhan"] = totalMatrix;

          setSymptomList(sortedSymptoms);
          setRawMatrix(monthlyMatrix);

          let targetSym = selectedSymptom;
          if (!sortedSymptoms.includes(targetSym)) {
            targetSym = "Total Keseluruhan";
            setSelectedSymptom(targetSym);
          }

          generateLineData(targetSym, monthlyMatrix);
        } else {
          setSymptomList([]);
          setRawMatrix({});
          setLineData([]);
        }
      } catch (err) {
        console.error("Gagal memuat data tren bulanan:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, [selectedYear]);

  // LOGIKA ASLIMU DENGAN PENAMBAHAN NULL AGAR TAHUN 2026 TIDAK MENARIK GARIS KE ANGKA 0
  const generateLineData = (targetSymptom: string, matrix: { [key: string]: number[] }) => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const volumes = matrix[targetSymptom] || Array(12).fill(0);

    let prevVol: number | null = null;
    let maxGrowth = -999;
    let maxGrowthIndex = -1;

    monthNames.forEach((_, idx) => {
      const vol = volumes[idx];
      if (idx > 0 && prevVol !== null && prevVol > 0) {
        let growth = Number((((vol - prevVol) / prevVol) * 100).toFixed(2));
        if (growth > maxGrowth) {
          maxGrowth = growth;
          maxGrowthIndex = idx; 
        }
      }
      prevVol = vol;
    });

    prevVol = null;
    let topSpikeDesc = "";

    const formattedLine = monthNames.map((bulan, idx) => {
      const vol = volumes[idx];
      // Jika nilai 0, ubah jadi null agar Recharts tidak menarik garis ke 0
      const displayVol = vol === 0 ? null : vol;

      let growth: number | null = null;
      let status = "Normal Fluktuatif";
      let statusColor = "bg-blue-50 text-blue-700 border-blue-100";
      let dotColor = "#94A3B8";
      let dotRadius = 4;

      if (idx > 0 && prevVol !== null && prevVol > 0 && displayVol !== null) {
        growth = Number((((displayVol - prevVol) / prevVol) * 100).toFixed(2));
        if (growth > 15) {
          status = "Lonjakan Kritis";
          statusColor = "bg-red-50 text-red-700 border-red-100";
        } else if (growth < -15) {
          status = "Penurunan Signifikan";
          statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
        }
        if (idx === maxGrowthIndex) {
          dotColor = "#DC2626";
          dotRadius = 6;
          topSpikeDesc = `Puncak Lonjakan Tertinggi (${growth > 0 ? '+' : ''}${growth}%)`;
        }
      }

      const result = { 
        bulan, 
        volume: displayVol, 
        rawVolume: vol,
        growthPercentage: growth, 
        operationalStatus: status, 
        statusColor, 
        dotColor, 
        dotRadius, 
        isSpikeSegment: idx === maxGrowthIndex || idx === maxGrowthIndex - 1 
      };
      prevVol = displayVol !== null ? displayVol : prevVol;
      return result;
    });

    setLineData(formattedLine);
    setHighestSpikeInfo(maxGrowthIndex !== -1 ? topSpikeDesc : "");
  };

  const handleSymptomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSym = e.target.value;
    setSelectedSymptom(newSym);
    generateLineData(newSym, rawMatrix);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-sm w-full flex justify-center items-center h-[380px]">
        <Loader2 className="animate-spin text-blue-600" size={28} />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm w-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600 shrink-0">
              <Activity size={18} />
            </div>
            <h2 className="text-sm font-bold text-[#1B2559]">
              Fluktuasi Tren Bulanan {selectedYear === "ALL" ? "Semua Tahun" : selectedYear}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Filter:</span>
            <select 
              value={selectedSymptom} 
              onChange={handleSymptomChange}
              className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 font-medium text-[#1B2559] focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 truncate shadow-sm"
            >
              {symptomList.map((sym, idx) => (
                <option key={idx} value={sym}>{sym}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full h-[280px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 25, right: 20, bottom: 5, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="bulan" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis 
                allowDecimals={false} 
                domain={[
                  (dataMin: number) => Math.floor((dataMin || 0) * 0.85), 
                  (dataMax: number) => Math.ceil((dataMax || 5) * 1.15)
                ]} 
                tick={{ fontSize: 10, fill: '#64748B' }} 
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    if (data.volume === null) return null;
                    return (
                      <div className="bg-white p-3.5 border border-slate-100 shadow-xl rounded-xl text-xs space-y-1 z-50">
                        <p className="font-bold text-[#1B2559] border-b pb-1 mb-1">{data.bulan} {selectedYear === "ALL" ? "" : selectedYear}</p>
                        <p className="text-slate-600">Volume Tiket: <span className="font-bold text-slate-800">{data.volume} Tiket</span></p>
                        <p className="text-slate-600">Pertumbuhan MoM: <span className={`font-bold ${data.growthPercentage !== null && data.growthPercentage > 15 ? 'text-red-600' : data.growthPercentage !== null && data.growthPercentage < -15 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {data.growthPercentage !== null ? `${data.growthPercentage > 0 ? '+' : ''}${data.growthPercentage}%` : 'Baseline Awal'}
                        </span></p>
                        <div className="pt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${data.statusColor} inline-block`}>
                            {data.operationalStatus}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Garis Utama dengan connectNulls={false} agar 2026 aman */}
              <Line 
                type="linear" 
                dataKey="volume" 
                stroke="#CBD5E1" 
                strokeWidth={2}
                connectNulls={false}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.volume === null) return null;
                  return (
                    <circle key={`dot-${payload.bulan}`} cx={cx} cy={cy} r={payload.dotRadius} fill={payload.dotColor} stroke="#fff" strokeWidth={2} />
                  );
                }}
                activeDot={{ r: 6 }}
              >
                <LabelList dataKey="volume" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1B2559' }} />
              </Line>

              {/* Garis Merah Penanda Lonjakan Asli */}
              <Line 
                type="linear" 
                dataKey={(item) => (item.isSpikeSegment ? item.volume : null)} 
                stroke="#EF4444" 
                strokeWidth={2.5}
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> <span className="font-medium text-slate-700">Lonjakan Kritis</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> <span className="font-medium text-slate-700">Penurunan Signifikan</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> <span>Normal</span></div>
        </div>
        <div className="font-bold text-red-600">{highestSpikeInfo}</div>
      </div>
    </div>
  );
}
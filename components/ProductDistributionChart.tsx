"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell 
} from "recharts";
import { Loader2, Layers } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProductDistributionChartProps {
  selectedYear: string;
}

export default function ProductDistributionChart({ selectedYear }: ProductDistributionChartProps) {
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [topSymptoms, setTopSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalAccumulation, setTotalAccumulation] = useState<number>(0);
  
  // State untuk melacak segmen bar mana yang sedang aktif di-hover
  const [activeTooltip, setActiveTooltip] = useState<{ symptom: string; value: number; color: string; product: string; total: number } | null>(null);

  const blueShades = ["#1E40AF", "#2563EB", "#60A5FA", "#93C5FD", "#BFDBFE"];
  const grayColor = "#E2E8F0"; 

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
            .select("productName, symptom, createdDate")
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

        // Filter data berdasarkan tahun yang dipilih (atau ambil semua jika "ALL")
        const filteredData = allData.filter((item) => {
          if (!item.createdDate || !item.productName) return false;
          const year = new Date(item.createdDate).getFullYear().toString();
          if (selectedYear === "ALL") return true;
          return year === selectedYear;
        });

        const symptomCounts: { [symptom: string]: number } = {};
        filteredData.forEach((item) => {
          const sym = item.symptom && item.symptom.trim() !== "" ? item.symptom : "Lainnya";
          symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
        });

        const sortedSymptoms = Object.keys(symptomCounts).sort((a, b) => symptomCounts[b] - symptomCounts[a]);
        const top4 = sortedSymptoms.slice(0, 4);
        const activeSymptoms = [...top4, "Lainnya"];
        setTopSymptoms(activeSymptoms);

        const uniqueProductsSet = new Set<string>();
        filteredData.forEach((item) => {
          uniqueProductsSet.add(item.productName);
        });
        const productList = Array.from(uniqueProductsSet);

        const matrix: { [product: string]: { [symptom: string]: number } } = {};
        productList.forEach((prod) => {
          matrix[prod] = {};
          activeSymptoms.forEach((sym) => {
            matrix[prod][sym] = 0;
          });
        });

        let totalValidTickets = 0;

        filteredData.forEach((item) => {
          const prod = item.productName;
          let sym = item.symptom && item.symptom.trim() !== "" ? item.symptom : "Lainnya";
          
          if (!top4.includes(sym)) {
            sym = "Lainnya";
          }

          if (matrix[prod] && matrix[prod][sym] !== undefined) {
            matrix[prod][sym] += 1;
            totalValidTickets++;
          }
        });

        const formattedData = productList.map((prod) => {
          const rowData: any = { product: prod };
          let prodTotal = 0;

          activeSymptoms.forEach((sym) => {
            const count = matrix[prod][sym] || 0;
            rowData[sym] = count;
            prodTotal += count;
          });

          rowData.total = prodTotal;
          return rowData;
        });

        formattedData.sort((a, b) => b.total - a.total);

        setDistributionData(formattedData);
        setTotalAccumulation(totalValidTickets);

      } catch (err) {
        console.error("Gagal memproses data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, [selectedYear]);

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
        {/* Header Dinamis mengikuti selectedYear */}
        <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-50 p-2 rounded-xl text-blue-600 shrink-0">
              <Layers size={18} />
            </div>
            <h2 className="text-sm font-bold text-[#1B2559]">
              Distribusi Gangguan Produk Layanan {selectedYear === "ALL" ? "Semua Tahun" : selectedYear}
            </h2>
          </div>

          <div className="bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl text-blue-700 text-xs font-bold shadow-sm shrink-0">
            Akumulasi: {totalAccumulation} Tiket
          </div>
        </div>

        {/* Area Grafik */}
        <div className="w-full h-[280px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={distributionData} 
              margin={{ top: 20, right: 15, bottom: 25, left: -15 }}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="product" 
                tick={{ fontSize: 9, fill: '#64748B', fontWeight: 'bold' }} 
                interval={0} 
                angle={-25}
                textAnchor="end"
                height={35}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} />
              
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={() => {
                  if (!activeTooltip || activeTooltip.value === 0) return null;
                  return (
                    <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl text-xs space-y-1.5 min-w-[180px] z-50">
                      <div className="font-bold text-slate-700 border-b pb-1 mb-1 flex justify-between">
                        <span>Produk: {activeTooltip.product}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: activeTooltip.color }}></span>
                          <span className="font-medium">{activeTooltip.symptom}</span>
                        </span>
                        <span className="font-bold text-slate-900">{activeTooltip.value} Tiket</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between text-slate-500 text-[11px]">
                        <span>Total Produk Ini:</span>
                        <span className="font-bold text-blue-600">{activeTooltip.total} Tiket</span>
                      </div>
                    </div>
                  );
                }}
              />

              {topSymptoms.map((sym, idx) => (
                <Bar 
                  key={sym} 
                  dataKey={sym} 
                  stackId="a" 
                  radius={idx === topSymptoms.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                >
                  {distributionData.map((row, index) => {
                    const fillColor = index === 0 ? blueShades[idx] : grayColor;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={fillColor} 
                        onMouseEnter={() => {
                          setActiveTooltip({
                            symptom: sym,
                            value: row[sym] || 0,
                            color: fillColor,
                            product: row.product,
                            total: row.total
                          });
                        }}
                      />
                    );
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Legend - Rata tengah, simpel, tanpa ranking */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px]">
          {topSymptoms.map((sym, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: blueShades[index] }}></span>
              <span className="font-medium">{sym}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
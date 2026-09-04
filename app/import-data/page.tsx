"use client";

import { useState, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, ChevronDown, ArrowRight, Loader2, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// Inisialisasi Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ImportDataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus("idle");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadStatus("idle");
    }
  };

 const handleUploadAndSync = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setUploadStatus("idle");

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("File Excel kosong atau format barisnya tidak terbaca.");
      }

      // Fungsi helper untuk mengubah Excel Serial Date Number menjadi format ISO String
      const excelDateToJSDate = (serial: any) => {
        if (serial === null || serial === undefined || serial === "" || Number.isNaN(serial)) return null;
        if (typeof serial !== "number") {
          // Kalau sudah berupa string tanggal, coba parse
          const parsed = new Date(serial);
          return isNaN(parsed.getTime()) ? null : parsed.toISOString();
        }
        
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        
        const fractional_day = serial - Math.floor(serial) + 0.0000001;
        let total_seconds = Math.floor(fractional_day * 86400);
        const seconds = total_seconds % 60;
        total_seconds -= seconds;
        const hours = Math.floor(total_seconds / (60 * 60));
        const minutes = Math.floor(total_seconds / 60) % 60;

        date_info.setUTCHours(hours);
        date_info.setUTCMinutes(minutes);
        date_info.setUTCSeconds(seconds);

        return date_info.toISOString();
      };

      // Fungsi helper untuk membersihkan nilai kosong agar tidak menjadi string ""
      const cleanVal = (val: any) => {
        if (val === undefined || val === null || val === "" || Number.isNaN(val)) {
          return null;
        }
        return val;
      };

      // Pemetaan eksplisit + konversi tanggal & pembersihan nilai kosong
      const mappedData = jsonData.map((row) => {
        const newRow: any = {};
        for (const key in row) {
          const cleanKey = key.trim();
          const lowerKey = cleanKey.toLowerCase();

          let val = row[key];

          // Konversi khusus untuk kolom tanggal
          if (
            lowerKey.includes("date") || 
            lowerKey.includes("created") || 
            lowerKey.includes("resolved") || 
            lowerKey.includes("response")
          ) {
            val = excelDateToJSDate(val);
          } else {
            val = cleanVal(val);
          }

          if (lowerKey === "ticket number") newRow["ticketNumber"] = cleanVal(val);
          else if (lowerKey === "product name") newRow["productName"] = cleanVal(val);
          else if (lowerKey === "product category") newRow["productCategory"] = cleanVal(val);
          else if (lowerKey === "symptom") newRow["symptom"] = cleanVal(val);
          else if (lowerKey === "unit pelapor") newRow["unitPelapor"] = cleanVal(val);
          else if (lowerKey === "priority") newRow["priority"] = cleanVal(val);
          else if (lowerKey === "created date") newRow["createdDate"] = val; // sudah dihandle excelDateToJSDate
          else if (lowerKey === "response date") newRow["responseDate"] = val;
          else if (lowerKey === "resolved date") newRow["resolvedDate"] = val;
          else if (lowerKey === "status") newRow["status"] = cleanVal(val);
          else if (lowerKey === "solver") newRow["solver"] = cleanVal(val);
          else if (lowerKey === "pic - solver") newRow["picSolver"] = cleanVal(val);
          else if (lowerKey === "escalate status") newRow["escalateStatus"] = cleanVal(val);
          else if (lowerKey === "reopen status") newRow["reopenStatus"] = cleanVal(val);
          else if (lowerKey === "target sla (jam)") newRow["targetSlaHours"] = cleanVal(val);
          else if (lowerKey === "sla status") newRow["slaStatus"] = cleanVal(val);
          else if (lowerKey === "alasan missed") newRow["alasanMissed"] = cleanVal(val);
          else if (lowerKey === "assignee group") newRow["assigneeGroup"] = cleanVal(val);
          else if (lowerKey === "sla status model") newRow["slaStatusModel"] = cleanVal(val);
          else if (lowerKey === "alasan missed model") newRow["alasanMissedModel"] = cleanVal(val);
          else {
            newRow[cleanKey] = cleanVal(val);
          }
        }
        return newRow;
      });

      // Menggunakan .upsert() agar data lama tetap aman, tapi jika ada ticketNumber yang sama akan ditimpa/di-update
      const { error: upsertError } = await supabase
        .from("Incident")
        .upsert(mappedData, { onConflict: "ticketNumber" });

      if (upsertError) throw upsertError;

      setIsLoading(false);
      setUploadStatus("success");
    } catch (error: any) {
      console.error("Gagal sync ke Supabase:", error);
      setIsLoading(false);
      setUploadStatus("error");
      setErrorMessage(error.message || "Terjadi kesalahan saat menyimpan ke database.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F4F7FE] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activePage="Import Data" />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header Section */}
        <header className="flex items-center justify-between px-8 pt-6 pb-2 flex-shrink-0">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold text-[#1B2559] tracking-tight">
              Data Management & Import
            </h1>
            <p className="text-slate-500 text-xs">
              Upload and sync operational ticket datasets for DMO dashboard analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Business Unit</span>
              <button className="flex items-center gap-2 font-bold text-[#1B2559] border border-blue-200 px-3 py-1 rounded-xl bg-white shadow-sm text-xs">
                Telkom Group <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="px-8 pb-6 pt-4 flex-1 flex flex-col gap-5 overflow-y-auto">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            className="hidden" 
          />

          {/* Upload Box / Drag & Drop Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center border-dashed border-2 transition-all cursor-pointer ${
              isDragging ? "border-blue-600 bg-blue-50/50" : "border-blue-200 hover:border-blue-500 bg-blue-50/20"
            }`}
          >
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-3 shadow-sm border border-blue-100">
              <UploadCloud size={32} />
            </div>
            
            {selectedFile ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-blue-200 shadow-sm text-xs font-bold text-[#1B2559]">
                  <FileSpreadsheet size={16} className="text-blue-600" />
                  <span>{selectedFile.name}</span>
                  <span className="text-slate-400 font-normal">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="ml-2 text-slate-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Excel file ready to be synchronized!</p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-[#1B2559]">Click to upload or drag and drop Excel file</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Support for Excel (.xlsx, .xls) operational incident logs
                </p>
                <button className="mt-5 bg-[#0052CC] hover:bg-[#003B95] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all">
                  Browse File
                </button>
              </>
            )}
          </div>

          {/* Status Notif Sukses */}
          {uploadStatus === "success" && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium animate-fadeIn">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>File successfully uploaded and synchronized to Supabase Incident table!</span>
            </div>
          )}

          {/* Status Notif Error */}
          {uploadStatus === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-medium">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span>Sync failed: {errorMessage}</span>
            </div>
          )}

          {/* Recent Upload Logs / History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between flex-1">
            <div>
              <h3 className="text-sm font-bold text-[#1B2559] mb-3">Recent Upload History</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-50 p-2.5 rounded-xl text-green-600 border border-green-100">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#1B2559]">incident_log_master.xlsx</h4>
                      <p className="text-[10px] text-slate-400">Ready for upload</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1 rounded-full text-[11px] font-bold">
                    <CheckCircle2 size={14} /> Ready
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
              <span className="text-xs text-slate-400 font-medium">
                {selectedFile ? `Selected: ${selectedFile.name}` : "Ready to update main performance database?"}
              </span>
              <button 
                onClick={handleUploadAndSync}
                disabled={!selectedFile || isLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all ${
                  !selectedFile 
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                    : "bg-[#1B2559] text-white hover:bg-slate-800 cursor-pointer"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Parsing & Syncing...
                  </>
                ) : (
                  <>
                    Sync to Dashboard <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
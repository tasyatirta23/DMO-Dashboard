import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const month = formData.get("month") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "File tidak ditemukan." }, { status: 400 });
    }

    // Baca isi file teks (misalnya format CSV)
    const text = await file.text();
    const rows = text.split("\n").map(row => row.trim()).filter(Boolean);

    if (rows.length <= 1) {
      return NextResponse.json({ success: false, error: "File CSV kosong atau format tidak valid." }, { status: 400 });
    }

    // Parsing sederhana baris CSV (asumsi header: ticketNumber, productName, symptom, priority, assigneeGroup, createdDate, status, slaStatus)
    const headers = rows[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
    
    const parsedData = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(",").map(val => val.trim().replace(/^["']|["']$/g, ""));
      const rowObj: any = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] || "";
      });

      // Pastikan ada tanggal atau masukkan ke bulan yang dipilih
      parsedData.push({
        ticketNumber: rowObj.ticketNumber || `TICK-${Math.floor(Math.random() * 100000)}`,
        productName: rowObj.productName || "Lainnya",
        symptom: rowObj.symptom || "Tidak ada keterangan",
        priority: rowObj.priority || "Medium",
        assigneeGroup: rowObj.assigneeGroup || "Unassigned",
        createdDate: rowObj.createdDate || `${month}-01`,
        status: rowObj.status || "Resolved",
        slaStatus: rowObj.slaStatus || "Achieved",
      });
    }

    // Masukkan data ke Supabase (tabel "Incident")
    const { error: insertError } = await supabase
      .from("Incident")
      .insert(parsedData);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({ success: true, message: "Data berhasil diunggah ke Supabase!" });
  } catch (error: any) {
    console.error("Error upload API:", error);
    return NextResponse.json({ success: false, error: error.message || "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
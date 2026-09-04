import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prediction, symptom, productName, priority, assigneeGroup } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { insight: "API Key Gemini belum disetel di environment variables." },
        { status: 400 }
      );
    }

    const promptCoT = `
      Bertindaklah sebagai Senior Data Scientist di PT Telkom Indonesia yang sedang menyusun laporan ringkas untuk Manajer Operasional. 
      Sistem klasifikasi ID3 mendeteksi tiket insiden dengan parameter:
      - Symptom: ${symptom}
      - Product: ${productName}
      - Priority: ${priority}
      - Assignee Group: ${assigneeGroup}
      - Prediksi SLA: ${prediction} (${prediction === 'MISSED' ? 'Berisiko Terlambat' : 'Aman'})

      Buat analisis yang sangat rapi dan terstruktur khusus untuk dibaca cepat oleh seorang manajer. 
      ATURAN FORMAT WAJIB (Ikuti persis tanpa melanggar):
      - Setiap poin harus menggunakan baris baru (ENTER / enter ke bawah), JANGAN pernah menggabungkan dua poin dalam satu baris horizontal.
      - Gunakan format list ke bawah seperti ini:

      1. Evaluasi Singkat:
      * Poin alasan pertama kenapa berisiko ${prediction}.
      * Poin alasan kedua pendukung.

      2. Akar Masalah Utama:
      * Poin potensi bottleneck pertama di tim ${assigneeGroup}.
      * Poin kendala teknis/operasional kedua.

      3. Rekomendasi Aksi Cepat (Actionable Steps):
      * Langkah taktis pertama untuk manajer.
      * Langkah taktis kedua untuk pencegahan.

      Jangan berikan teks pengantar atau penutup apa pun. Langsung mulai dari nomor 1.
    `;

    // Menggunakan endpoint native Google AI Studio yang mendukung key baru berawalan AQ.
    const apiResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptCoT }],
        },
      ],
    }),
  }
);

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      throw new Error(data.error?.message || "Gagal terhubung ke endpoint Gemini API.");
    }

    const insightText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Tidak ada analisis yang dihasilkan oleh AI.";

    return NextResponse.json({ insight: insightText });
  } catch (error: any) {
    console.error("Detail Error API:", error);
    return NextResponse.json(
      { insight: `Gagal memproses AI: ${error.message || "Terjadi kesalahan internal."}` },
      { status: 500 }
    );
  }
}
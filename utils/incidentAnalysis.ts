// utils/incidentAnalysis.ts

interface RawTicket {
  ticketNumber?: string;
  ticket_number?: string;
  symptom: string;
  createdDate?: string;
  created_date?: string;
}

interface MonthlyTrendResult {
  month: string;
  symptom: string;
  volume: number;
  growthPercentage: number | null;
  operationalStatus: 'Lonjakan Kritis' | 'Normal Fluktuatif' | 'Penurunan Signifikan';
}

export function processIncidentTrends(rawTickets: RawTicket[], threshold: number = 15) {
  const symptomTotals: { [key: string]: number } = {};
  const monthlyData: { [symptom: string]: { [monthKey: string]: number } } = {};

  const totalPopulation = rawTickets.length;

  rawTickets.forEach(ticket => {
    const symptom = ticket.symptom || "Lainnya";
    const rawDate = ticket.createdDate || ticket.created_date || "";
    const dateStr = rawDate.toString().trim();

    // Ambil string format "YYYY-MM" secara aman dari data tanggal
    if (dateStr.length >= 7) {
      const yearStr = dateStr.substring(0, 4);
      const monthStr = dateStr.substring(5, 7);
      const month = parseInt(monthStr, 10);

      // Validasi bulan (1-12) tanpa mengunci tahun tertentu agar data 2025/2026/dll aman masuk
      if (!isNaN(month) && month >= 1 && month <= 12) {
        const monthKey = `${yearStr}-${String(month).padStart(2, '0')}`;

        symptomTotals[symptom] = (symptomTotals[symptom] || 0) + 1;

        if (!monthlyData[symptom]) monthlyData[symptom] = {};
        monthlyData[symptom][monthKey] = (monthlyData[symptom][monthKey] || 0) + 1;
      }
    }
  });

  const annualDistribution = Object.keys(symptomTotals)
    .map(symptom => ({
      symptom,
      totalTiket: symptomTotals[symptom],
      contributionPercentage: Number(((symptomTotals[symptom] / totalPopulation) * 100).toFixed(2))
    }))
    .sort((a, b) => b.totalTiket - a.totalTiket);

  // Cari tahun yang paling dominan dari data yang masuk, atau fallback ke tahun berjalan
  let targetYear = "2025";
  const allMonthsFound = new Set<string>();
  Object.keys(monthlyData).forEach(sym => {
    Object.keys(monthlyData[sym]).forEach(mKey => {
      allMonthsFound.add(mKey);
      targetYear = mKey.substring(0, 4); // Ambil tahun dari data asli
    });
  });

  const monthsList = Array.from({ length: 12 }, (_, i) => 
    `${targetYear}-${String(i + 1).padStart(2, '0')}`
  );

  const detailedTrends: MonthlyTrendResult[] = [];

  Object.keys(monthlyData).forEach(symptom => {
    let prevVolume: number | null = null;

    monthsList.forEach((monthKey, index) => {
      const volume = monthlyData[symptom][monthKey] || 0;
      let growthPercentage: number | null = null;
      let operationalStatus: 'Lonjakan Kritis' | 'Normal Fluktuatif' | 'Penurunan Signifikan' = 'Normal Fluktuatif';

      if (index === 0) {
        operationalStatus = 'Normal Fluktuatif';
      } else if (prevVolume !== null && prevVolume > 0) {
        growthPercentage = Number((((volume - prevVolume) / prevVolume) * 100).toFixed(2));

        if (growthPercentage > threshold) {
          operationalStatus = 'Lonjakan Kritis';
        } else if (growthPercentage <= -threshold) {
          operationalStatus = 'Penurunan Signifikan';
        } else {
          operationalStatus = 'Normal Fluktuatif';
        }
      }

      detailedTrends.push({
        month: monthKey,
        symptom,
        volume,
        growthPercentage,
        operationalStatus
      });

      prevVolume = volume;
    });
  });

  return {
    totalPopulation,
    annualDistribution,
    detailedTrends
  };
}
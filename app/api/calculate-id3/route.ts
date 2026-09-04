import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

function calculateEntropy(data: any[]): number {
  const total = data.length;
  if (total === 0) return 0;
  const counts: { [key: string]: number } = {};
  data.forEach(item => {
    const status = (item.slaStatus || 'ACHIEVED').toUpperCase();
    counts[status] = (counts[status] || 0) + 1;
  });
  let entropy = 0;
  for (const key in counts) {
    const p = counts[key] / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function calculateGain(data: any[], attribute: string, totalEntropy: number): number {
  const total = data.length;
  if (total === 0) return 0;
  const groups: { [key: string]: any[] } = {};
  data.forEach(item => {
    const val = item[attribute] || '-';
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
  });
  let weightedEntropy = 0;
  for (const val in groups) {
    const subset = groups[val];
    weightedEntropy += (subset.length / total) * calculateEntropy(subset);
  }
  return Math.max(0, totalEntropy - weightedEntropy);
}

interface TreeNode {
  attribute?: string;
  branches?: { [value: string]: TreeNode };
  prediction?: string;
  count?: number;
  achievedCount?: number;
  missedCount?: number;
}

function buildID3Tree(data: any[], attributes: string[]): TreeNode {
  const targetValues = data.map(i => (i.slaStatus || 'ACHIEVED').toUpperCase());
  const firstTarget = targetValues[0];
  
  if (targetValues.every(val => val === firstTarget)) {
    const achieved = targetValues.filter(v => v === 'ACHIEVED').length;
    const missed = targetValues.filter(v => v === 'MISSED').length;
    return { prediction: firstTarget, count: data.length, achievedCount: achieved, missedCount: missed };
  }

  if (attributes.length === 0 || data.length === 0) {
    const achieved = targetValues.filter(v => v === 'ACHIEVED').length;
    const missed = targetValues.filter(v => v === 'MISSED').length;
    const majority = achieved >= missed ? 'ACHIEVED' : 'MISSED';
    return { prediction: majority, count: data.length, achievedCount: achieved, missedCount: missed };
  }

  const totalEntropy = calculateEntropy(data);
  let bestAttribute = attributes[0];
  let maxGain = -1;

  attributes.forEach(attr => {
    const gain = calculateGain(data, attr, totalEntropy);
    if (gain > maxGain) {
      maxGain = gain;
      bestAttribute = attr;
    }
  });

  const tree: TreeNode = { attribute: bestAttribute, branches: {} };
  const remainingAttributes = attributes.filter(attr => attr !== bestAttribute);

  const groups: { [key: string]: any[] } = {};
  data.forEach(item => {
    const val = item[bestAttribute] || '-';
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
  });

  for (const val in groups) {
    tree.branches![val] = buildID3Tree(groups[val], remainingAttributes);
  }

  return tree;
}

function extractRules(node: TreeNode, currentCondition: any = {}, allRules: any[] = []): any[] {
  if (!node.branches) {
    allRules.push({
      ...currentCondition,
      prediction: node.prediction || 'ACHIEVED',
      count: node.count || 0,
      achieved: node.achievedCount || 0,
      missed: node.missedCount || 0
    });
    return allRules;
  }

  const attr = node.attribute!;
  for (const val in node.branches) {
    extractRules(node.branches[val], { ...currentCondition, [attr]: val }, allRules);
  }

  return allRules;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '2025-01';
  const action = url.searchParams.get('action');
  
  const pSymptom = url.searchParams.get('symptom');
  const pProduct = url.searchParams.get('productName');
  const pPriority = url.searchParams.get('priority');
  const pAssignee = url.searchParams.get('assigneeGroup');

  try {
    const [year, m] = month.split('-').map(Number);
    const startDate = `${month}-01T00:00:00`;
    const nextMonthYear = m === 12 ? year + 1 : year;
    const nextMonthVal = m === 12 ? 1 : m + 1;
    const endDate = `${nextMonthYear}-${String(nextMonthVal).padStart(2, '0')}-01T00:00:00`;

    const { data: incidents, error } = await supabase
      .from('Incident')
      .select('*')
      .gte('createdDate', startDate)
      .lt('createdDate', endDate);

    if (error) throw error;

    const totalData = incidents?.length || 0;

    // Ambil list unik master data asli dari tabel incident bulan tersebut untuk dropdown form prediksi yang utuh
    const uniqueSymptoms = Array.from(new Set(incidents?.map(i => i.symptom).filter(Boolean))).sort();
    const uniqueProducts = Array.from(new Set(incidents?.map(i => i.productName).filter(Boolean))).sort();
    const uniquePriorities = Array.from(new Set(incidents?.map(i => i.prority || i.priority).filter(Boolean))).sort();
    const uniqueAssignees = Array.from(new Set(incidents?.map(i => i.assigneeGroup).filter(Boolean))).sort();

    if (totalData === 0) {
      return NextResponse.json({
        success: true,
        month,
        accuracy: "0%",
        attributeGains: [],
        pieData: [],
        rules: [],
        uniqueSymptoms,
        uniqueProducts,
        uniquePriorities,
        uniqueAssignees
      });
    }

    const normalizedData = incidents.map(inc => ({
      symptom: inc.symptom || '-',
      productName: inc.productName || '-',
      priority: inc.prority || inc.priority || '-',
      assigneeGroup: inc.assigneeGroup || '-',
      slaStatus: (inc.slaStatus || 'ACHIEVED').toUpperCase()
    }));

    const totalEntropy = calculateEntropy(normalizedData);
    const attributes = ['symptom', 'productName', 'priority', 'assigneeGroup'];

    const attributeGains = attributes.map(attr => ({
      attribute: attr === 'productName' ? 'Product Name' : attr === 'assigneeGroup' ? 'Assignee Group' : attr.charAt(0).toUpperCase() + attr.slice(1),
      gain: Number(calculateGain(normalizedData, attr, totalEntropy).toFixed(4))
    })).sort((a, b) => b.gain - a.gain);

    const decisionTree = buildID3Tree(normalizedData, attributes);
    let extracted = extractRules(decisionTree);

    extracted.sort((a, b) => {
      if (a.prediction === 'MISSED' && b.prediction !== 'MISSED') return -1;
      if (a.prediction !== 'MISSED' && b.prediction === 'MISSED') return 1;
      return b.count - a.count;
    });

    const formattedRules = extracted.map((rule, idx) => ({
      id: idx + 1,
      symptom: rule.symptom || '-',
      productName: rule.productName || '-',
      priority: rule.priority || '-',
      assigneeGroup: rule.assigneeGroup || '-',
      prediction: rule.prediction,
      n: rule.count,
      achieved: rule.achieved,
      missed: rule.missed
    }));

    if (action === 'predict' && pSymptom) {
      let matchedPrediction = "ACHIEVED";
      let matchedRuleId = null;

      const cleanInput = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const userSymClean = cleanInput(pSymptom);
      const userProdClean = cleanInput(pProduct || '');
      const userPriClean = cleanInput(pPriority || '');
      const userAsgClean = cleanInput(pAssignee || '');

      for (const r of formattedRules) {
        const ruleSymClean = cleanInput(r.symptom);
        const ruleProdClean = cleanInput(r.productName);
        const rulePriClean = cleanInput(r.priority);
        const ruleAsgClean = cleanInput(r.assigneeGroup);

        const matchSym = r.symptom === '-' || userSymClean.includes(ruleSymClean) || ruleSymClean.includes(userSymClean);
        const matchProd = r.productName === '-' || userProdClean.includes(ruleProdClean) || ruleProdClean.includes(userProdClean);
        const matchPri = r.priority === '-' || userPriClean.includes(rulePriClean) || rulePriClean.includes(userPriClean);
        const matchAsg = r.assigneeGroup === '-' || userAsgClean.includes(ruleAsgClean) || ruleAsgClean.includes(userAsgClean);

        if (matchSym && matchProd && matchPri && matchAsg) {
          matchedPrediction = r.prediction;
          matchedRuleId = r.id;
          if (r.prediction === 'MISSED') {
            break;
          }
        }
      }

      return NextResponse.json({
        success: true,
        prediction: matchedPrediction,
        matchedRuleId,
        cot: `Model ID3 mengevaluasi kombinasi atribut dan mencocokkannya dengan Aturan #${matchedRuleId || 'Mayoritas'}, menghasilkan status: ${matchedPrediction}.`
      });
    }

    const achievedCount = normalizedData.filter(i => i.slaStatus === 'ACHIEVED').length;
    const missedCount = totalData - achievedCount;
    const accuracyVal = ((achievedCount / totalData) * 100).toFixed(1) + "%";

    const pieData = [
      { name: "ACHIEVED", value: achievedCount, color: "#10B981" },
      { name: "MISSED", value: missedCount, color: "#EF4444" },
    ];

    return NextResponse.json({
      success: true,
      month,
      accuracy: accuracyVal,
      attributeGains,
      pieData,
      rules: formattedRules,
      uniqueSymptoms,
      uniqueProducts,
      uniquePriorities,
      uniqueAssignees
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
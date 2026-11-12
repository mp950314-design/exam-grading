import { supabase } from "./supabase";
import type { GradingRecord, GradingResult } from "../types";

export async function saveGrading(
  subject: string,
  question: string,
  answer: string,
  result: GradingResult,
  referenceMaterial?: string
) {
  const { error } = await supabase.from("essay_gradings").insert({
    subject,
    question,
    answer,
    reference_material: referenceMaterial?.trim() || null,
    overall_score: result.overall_score,
    dimensions: result.dimensions,
    paragraph_notes: result.paragraph_notes,
    summary: result.summary,
  });
  if (error) throw new Error(`儲存失敗：${error.message}`);
}

export async function fetchHistory(): Promise<GradingRecord[]> {
  const { data, error } = await supabase
    .from("essay_gradings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`讀取歷史紀錄失敗：${error.message}`);
  return (data || []) as GradingRecord[];
}

// "62-68" -> 65；單一數字也支援
export function scoreMidpoint(range: string | null): number | null {
  if (!range) return null;
  const nums = range.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const values = nums.map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function averageBySubject(
  records: GradingRecord[]
): { subject: string; average: number; count: number }[] {
  const groups = new Map<string, number[]>();
  for (const r of records) {
    const mid = scoreMidpoint(r.overall_score);
    if (mid === null) continue;
    const list = groups.get(r.subject) || [];
    list.push(mid);
    groups.set(r.subject, list);
  }
  return Array.from(groups.entries()).map(([subject, scores]) => ({
    subject,
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length,
  }));
}

// 依平均分數由低到高排序，排最前面的就是最弱的維度
export function weakestDimensions(
  records: GradingRecord[]
): { name: string; average: number; count: number }[] {
  const groups = new Map<string, number[]>();
  for (const r of records) {
    for (const d of r.dimensions || []) {
      const list = groups.get(d.name) || [];
      list.push(d.score);
      groups.set(d.name, list);
    }
  }
  const result = Array.from(groups.entries()).map(([name, scores]) => ({
    name,
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length,
  }));
  result.sort((a, b) => a.average - b.average);
  return result;
}
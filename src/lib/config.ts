import { useQuery } from "@tanstack/react-query";
import examPdf from "@/assets/Japanese_Exam_Paper.pdf.asset.json";

export type GradeDef = {
  min: number;
  letter: "S" | "A" | "B" | "C" | "F";
  jp: string;
  en: string;
  message: string;
};

export type TestDef = {
  id?: string;
  name: string;
  totalMarks: number;
  pdfUrl?: string;
};

export type SiteConfig = {
  activeTest: TestDef | null;
  tests: TestDef[];
  site: { title: string; subtitle: string };
  grades: GradeDef[];
};

// ---------------------------------------------------------------------------
// Static config. Edit this file to add / remove tests. No GitHub JSON anymore.
// ---------------------------------------------------------------------------
const TODAYS_TEST: TestDef = {
  id: "japanese-assessment-2026-06",
  name: "Japanese Language Assessment",
  totalMarks: 50,
  pdfUrl: examPdf.url,
};

export const SITE_CONFIG: SiteConfig = {
  activeTest: TODAYS_TEST,
  tests: [TODAYS_TEST],
  site: {
    title: "Japanese Learning For All",
    subtitle: "Submit Your Test Results",
  },
  grades: [
    { min: 90, letter: "S", jp: "優秀", en: "Excellent", message: "素晴らしい！継続してください！" },
    { min: 75, letter: "A", jp: "良い", en: "Good", message: "よくできました！" },
    { min: 60, letter: "B", jp: "普通", en: "Average", message: "いい調子です！" },
    { min: 40, letter: "C", jp: "もう少し", en: "Needs Improvement", message: "もっと頑張れます！" },
    { min: 0,  letter: "F", jp: "不合格", en: "Fail", message: "あきらめないで！" },
  ],
};

export const DEFAULT_CONFIG = SITE_CONFIG;
export const MANUAL_VALUE = "__manual__";

export function useConfig() {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async () => SITE_CONFIG,
    staleTime: Infinity,
    placeholderData: SITE_CONFIG,
  });
}

export function gradeFor(percentage: number, grades: GradeDef[]): GradeDef {
  const sorted = grades.slice().sort((a, b) => b.min - a.min);
  for (const g of sorted) if (percentage >= g.min) return g;
  return sorted[sorted.length - 1];
}

export function gradeColorClass(letter: GradeDef["letter"]): string {
  switch (letter) {
    case "S": return "text-grade-s";
    case "A": return "text-grade-a";
    case "B": return "text-grade-b";
    case "C": return "text-grade-c";
    case "F": return "text-grade-f";
  }
}

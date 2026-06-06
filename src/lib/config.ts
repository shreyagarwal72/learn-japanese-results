import { useQuery } from "@tanstack/react-query";

export type GradeDef = {
  /** Minimum raw marks required for this grade (out of total). */
  min: number;
  letter: "S" | "A" | "B" | "C" | "D" | "F";
  jp: string;
  en: string;
  message: string;
};

export type TestDef = {
  id?: string;
  name: string;
  totalMarks: number;
  questionPaperUrl?: string;
  answerKeyUrl?: string;
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
  questionPaperUrl: "https://kklz19o6an7qwti4.public.blob.vercel-storage.com/Japanese_Exam_Paper.pdf",
  answerKeyUrl: "https://kklz19o6an7qwti4.public.blob.vercel-storage.com/Japanese_Exam_Answer_Key.pdf",
};

export const SITE_CONFIG: SiteConfig = {
  activeTest: TODAYS_TEST,
  tests: [TODAYS_TEST],
  site: {
    title: "Japanese Learning For All",
    subtitle: "Submit Your Test Results",
  },
  grades: [
    { min: 45, letter: "S", jp: "優秀",     en: "Excellent",         message: "素晴らしい！継続してください！" },
    { min: 35, letter: "A", jp: "良い",     en: "Good",              message: "よくできました！" },
    { min: 25, letter: "B", jp: "普通",     en: "Average",           message: "いい調子です！" },
    { min: 15, letter: "C", jp: "もう少し", en: "Needs Improvement", message: "もっと頑張れます！" },
    { min: 5,  letter: "D", jp: "努力",     en: "Keep Trying",       message: "次はもっと良くなります！" },
    { min: 0,  letter: "F", jp: "不合格",   en: "Fail",              message: "あきらめないで！" },
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

/** Grade is determined by raw marks obtained (not percentage). */
export function gradeFor(obtained: number, grades: GradeDef[]): GradeDef {
  const sorted = grades.slice().sort((a, b) => b.min - a.min);
  for (const g of sorted) if (obtained >= g.min) return g;
  return sorted[sorted.length - 1];
}

export function gradeColorClass(letter: GradeDef["letter"]): string {
  switch (letter) {
    case "S": return "text-grade-s";
    case "A": return "text-grade-a";
    case "B": return "text-grade-b";
    case "C": return "text-grade-c";
    case "D": return "text-grade-d";
    case "F": return "text-grade-f";
  }
}

import { useQuery } from "@tanstack/react-query";

export type GradeDef = {
  min: number;
  letter: "S" | "A" | "B" | "C" | "F";
  jp: string;
  en: string;
  message: string;
};

export type SiteConfig = {
  activeTest: { name: string; totalMarks: number } | null;
  site: { title: string; subtitle: string };
  grades: GradeDef[];
};

export const DEFAULT_CONFIG: SiteConfig = {
  activeTest: null,
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

// Public raw JSON on GitHub. Update the file there and the site reflects it
// on the next page load. Repo: github.com/shreyagarwal72/jlfa-config (file: config.json on main).
// Override with VITE_CONFIG_URL if you want a different location.
const CONFIG_URL =
  (import.meta.env.VITE_CONFIG_URL as string | undefined) ||
  "https://raw.githubusercontent.com/shreyagarwal72/jlfa-config/main/config.json";

async function fetchConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_CONFIG;
    const json = (await res.json()) as Partial<SiteConfig>;
    return {
      activeTest: json.activeTest ?? DEFAULT_CONFIG.activeTest,
      site: { ...DEFAULT_CONFIG.site, ...(json.site ?? {}) },
      grades:
        Array.isArray(json.grades) && json.grades.length > 0
          ? (json.grades as GradeDef[]).slice().sort((a, b) => b.min - a.min)
          : DEFAULT_CONFIG.grades,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function useConfig() {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: fetchConfig,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    placeholderData: DEFAULT_CONFIG,
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

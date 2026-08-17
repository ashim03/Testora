import { LearningProfile, Question, Result } from "../models";

const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
type Difficulty = (typeof DIFFICULTY_LEVELS)[number];
interface AdaptivePracticeOptions { limit?: number; category?: string; }
interface WeakArea { category: string; averageScore: number; difficulty: Difficulty; source: "ASSESSMENT" | "AI_FEEDBACK"; }

const difficultyFor = (score: number): Difficulty => score < 50 ? "EASY" : score < 70 ? "MEDIUM" : "HARD";

async function buildWeakAreas(studentId: string, category?: string): Promise<WeakArea[]> {
  const [recentResults, profile] = await Promise.all([
    Result.find({ studentId, published: true }).sort({ createdAt: -1 }).limit(20).select("category percentage finalScore skillScores").lean(),
    LearningProfile.findOne({ studentId }).lean(),
  ]);

  const areas = new Map<string, { scores: number[]; source: "ASSESSMENT" | "AI_FEEDBACK" }>();
  for (const result of recentResults) {
    if (category && result.category !== category) continue;
    const key = result.category || "OTHER";
    const score = typeof result.percentage === "number" ? result.percentage : Number(result.finalScore || 0);
    const entry = areas.get(key) || { scores: [], source: "ASSESSMENT" as const };
    entry.scores.push(Math.max(0, Math.min(100, score)));
    areas.set(key, entry);
    for (const [skill, raw] of Object.entries(result.skillScores || {})) {
      if (category && skill !== category) continue;
      const skillScore = Number(raw);
      if (!Number.isFinite(skillScore)) continue;
      const skillEntry = areas.get(skill) || { scores: [], source: "ASSESSMENT" as const };
      skillEntry.scores.push(Math.max(0, Math.min(100, skillScore)));
      areas.set(skill, skillEntry);
    }
  }

  if (profile?.skills) {
    const entries = profile.skills instanceof Map ? [...profile.skills.entries()] : Object.entries(profile.skills);
    for (const [skill, mastery] of entries) {
      const score = Number((mastery as { score?: number }).score);
      if (!Number.isFinite(score)) continue;
      areas.set(skill, { scores: [score], source: "AI_FEEDBACK" });
    }
  }

  return [...areas.entries()].map(([name, value]) => {
    const averageScore = value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length;
    return { category: name, averageScore: Math.round(averageScore * 10) / 10, difficulty: difficultyFor(averageScore), source: value.source };
  }).sort((a, b) => a.averageScore - b.averageScore);
}

export async function getAdaptivePractice(studentId: string, options: AdaptivePracticeOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const weakAreas = await buildWeakAreas(studentId, options.category);
  const targetAreas = weakAreas.length ? weakAreas.slice(0, Math.min(3, weakAreas.length)) : [{ category: options.category || "", averageScore: 50, difficulty: "MEDIUM" as Difficulty, source: "ASSESSMENT" as const }];
  const perArea = Math.max(1, Math.ceil(limit / targetAreas.length));

  const questionGroups = await Promise.all(targetAreas.map(async (area) => {
    const filter: Record<string, unknown> = { deletedAt: null, isPublic: true, difficulty: area.difficulty };
    if (area.category) filter.$or = [{ category: area.category }, { tags: area.category }, { topic: area.category }];
    return Question.find(filter)
      .select("_id category type title instructions passage passageId options audioUrl audioAssetId audioDuration audioPlayRules imageUrl videoUrl maxWordLimit minWordLimit marks negativeMarks difficulty explanation tags rubric")
      .sort({ createdAt: -1 }).limit(perArea).lean();
  }));

  return {
    questions: questionGroups.flat().slice(0, limit),
    weakAreas,
    plan: targetAreas.map((area) => ({ skill: area.category || "General practice", mastery: area.averageScore, difficulty: area.difficulty, reason: area.averageScore < 50 ? "Priority weakness" : area.averageScore < 70 ? "Needs reinforcement" : "Maintain mastery" })),
  };
}

export async function getLearningProfile(studentId: string) {
  const profile = await LearningProfile.findOne({ studentId }).lean();
  if (!profile) return { skills: [], totalPracticeSessions: 0, currentStreak: 0, lastPracticeAt: null };
  const entries = profile.skills instanceof Map ? [...profile.skills.entries()] : Object.entries(profile.skills || {});
  return {
    skills: entries.map(([skill, mastery]) => ({ skill, ...mastery })).sort((a, b) => a.score - b.score),
    totalPracticeSessions: profile.totalPracticeSessions,
    currentStreak: profile.currentStreak,
    lastPracticeAt: profile.lastPracticeAt,
  };
}

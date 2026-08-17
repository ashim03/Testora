import { Question, Result } from "../models";

const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

interface AdaptivePracticeOptions {
  limit?: number;
  category?: string;
}

interface WeakArea {
  category: string;
  averageScore: number;
  difficulty: Difficulty;
}

/**
 * Selects practice questions from a student's weakest recent areas.
 * This is intentionally read-only so it can be integrated with existing
 * practice/exam flows without changing attempt or grading behaviour.
 */
export async function getAdaptivePractice(
  studentId: string,
  options: AdaptivePracticeOptions = {},
): Promise<{ questions: unknown[]; weakAreas: WeakArea[] }> {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const recentResults = await Result.find({ studentId, published: true })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("category finalScore percentage")
    .lean();

  const scores = new Map<string, number[]>();
  for (const result of recentResults) {
    if (options.category && result.category !== options.category) continue;
    const key = result.category || "OTHER";
    const score = typeof result.percentage === "number"
      ? result.percentage
      : Number(result.finalScore || 0);
    const values = scores.get(key) ?? [];
    values.push(score);
    scores.set(key, values);
  }

  const weakAreas: WeakArea[] = [...scores.entries()]
    .map(([category, values]) => {
      const averageScore = values.reduce((sum, value) => sum + value, 0) / values.length;
      const difficulty: Difficulty = averageScore < 50 ? "EASY" : averageScore < 70 ? "MEDIUM" : "HARD";
      return { category, averageScore, difficulty };
    })
    .sort((a, b) => a.averageScore - b.averageScore);

  const targetAreas = weakAreas.length
    ? weakAreas.slice(0, Math.min(3, weakAreas.length))
    : [{ category: options.category || "", averageScore: 0, difficulty: "MEDIUM" as Difficulty }];

  const perArea = Math.max(1, Math.ceil(limit / targetAreas.length));
  const questions: unknown[] = [];

  for (const area of targetAreas) {
    const filter: Record<string, unknown> = {
      deletedAt: null,
      isPublic: true,
      difficulty: area.difficulty,
    };
    if (area.category) filter.category = area.category;

    const selected = await Question.find(filter)
      .select("_id category type title instructions passage passageId options audioUrl audioAssetId audioDuration audioPlayRules imageUrl videoUrl maxWordLimit minWordLimit marks negativeMarks difficulty explanation tags rubric")
      .sort({ createdAt: -1 })
      .limit(perArea)
      .lean();

    questions.push(...selected);
  }

  return {
    questions: questions.slice(0, limit),
    weakAreas,
  };
}

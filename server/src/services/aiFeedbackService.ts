import { AIFeedback, ExamAnswer, ExamAttempt, Exam, LearningProfile, Question } from "../models";
import type { ISkillMastery } from "../models/LearningProfile";
import type { AiAnalysisResult, AiErrorAnnotation, AIFeedbackType } from "@testora-platform/shared";
import { ApiError } from "../utils/helpers";

export type FeedbackType = AIFeedbackType;
export type AiFeedback = AiAnalysisResult;
const ANNOTATION_SEVERITIES = new Set(["low", "medium", "high"]);

const MODEL = process.env.AI_MODEL || "qwen-plus";
const BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const API_URL = `${BASE_URL}/responses`;
// Qwen-family MaaS gateways (Aliyun/DashScope) default to "thinking" mode,
// which burns most of the latency budget on hidden reasoning tokens. Disable
// it unless the operator explicitly opts in via AI_ENABLE_THINKING=true.
const DISABLE_THINKING = /maas|aliyuncs|dashscope|qwen/i.test(BASE_URL) && process.env.AI_ENABLE_THINKING !== "true";
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const clampTrend = (value: number) => Math.max(-100, Math.min(100, Math.round(value)));

function extractOutputText(payload: { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }): string {
  return (payload.output || []).filter((item) => item.type === "message").flatMap((item) => item.content || []).filter((part) => part.type === "output_text" && part.text).map((part) => part.text as string).join("\n").trim();
}
export function parseJson(text: string, submissionLength: number): AiFeedback {
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim()) as AiFeedback;
    if (typeof parsed.overallScore !== "number" || !parsed.skillScores || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.improvements)) throw new Error();
    parsed.overallScore = clamp(parsed.overallScore);
    parsed.skillScores = Object.fromEntries(Object.entries(parsed.skillScores).map(([key, value]) => [key, clamp(Number(value))]).filter(([, value]) => Number.isFinite(value)));
    parsed.bands = parsed.bands && typeof parsed.bands === "object" ? { ielts: typeof parsed.bands.ielts === "number" ? clamp(Math.max(0, Math.min(9, parsed.bands.ielts))) : null, pte: typeof parsed.bands.pte === "number" ? clamp(Math.max(0, Math.min(90, parsed.bands.pte))) : null } : null;
    parsed.annotations = Array.isArray(parsed.annotations) ? parsed.annotations.filter((a: AiErrorAnnotation) => a && typeof a === "object" && typeof a.start === "number" && typeof a.end === "number" && typeof a.original === "string" && typeof a.correction === "string").map((a: AiErrorAnnotation) => ({ ...a, start: Math.max(0, Math.min(submissionLength, Math.trunc(a.start))), end: Math.max(0, Math.min(submissionLength, Math.trunc(a.end))), severity: ANNOTATION_SEVERITIES.has(a.severity) ? a.severity : "medium" })).slice(0, 50) : [];
    parsed.modelAnswer = typeof parsed.modelAnswer === "string" && parsed.modelAnswer.trim() ? parsed.modelAnswer.trim().slice(0, 5000) : null;
    parsed.advice = typeof parsed.advice === "string" && parsed.advice.trim() ? parsed.advice.trim().slice(0, 2000) : null;
    return parsed;
  } catch { throw new ApiError(502, "AI feedback returned an invalid response"); }
}

async function updateLearningProfile(studentId: string, skillScores: Record<string, number>) {
  const profile = await LearningProfile.findOneAndUpdate({ studentId }, { $setOnInsert: { studentId } }, { upsert: true, new: true });
  const skills = profile.skills as unknown as Map<string, ISkillMastery>;
  for (const [skill, rawScore] of Object.entries(skillScores)) {
    const score = clamp(rawScore);
    const previous = skills.get(skill) || { score: 50, attempts: 0, trend: 0, lastPracticedAt: null };
    const nextScore = previous.attempts === 0 ? score : clamp(previous.score * 0.7 + score * 0.3);
    skills.set(skill, { score: nextScore, attempts: previous.attempts + 1, trend: clampTrend(nextScore - previous.score), lastPracticedAt: new Date() });
  }
  profile.skills = skills;
  profile.totalPracticeSessions += 1;
  profile.lastPracticeAt = new Date();
  await profile.save();
}

export async function evaluateLanguage(type: FeedbackType, text: string, prompt?: string): Promise<AiFeedback> {
  if (!process.env.AI_API_KEY) throw new ApiError(503, "AI feedback is not configured");
  const normalized = text.trim();
  if (normalized.length < 20) throw new ApiError(400, "Response is too short for meaningful feedback");
  if (normalized.length > 12000) throw new ApiError(400, "Response exceeds the 12,000 character limit");
  const rubric = type === "WRITING"
    ? "Evaluate as an IELTS/PTE Academic writing examiner using official band descriptors: Task Response/Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy (IELTS bands 0-9); for PTE Academic use content, form, vocabulary, grammar, and spelling criteria (PTE 0-90). Calibrate every skillScore and the overall score (0-100) against the band scales, and set bands.ielts (0-9, half bands allowed like 6.5) and bands.pte (0-90) whenever confident, otherwise null."
    : "Evaluate as an IELTS/PTE speaking examiner from the supplied transcript: IELTS Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation (do not claim to assess pronunciation from text alone); PTE Academic oral fluency, pronunciation, and content criteria. Calibrate every skillScore and the overall score (0-100) against the band scales, and set bands.ielts (0-9, half bands allowed like 6.5) and bands.pte (0-90) whenever confident, otherwise null. Score how fully the response addresses the task prompt and stays on topic into skillScores.taskResponse (0-100); set it to null if no task prompt is provided.";
  const input = `You are an IELTS/PTE Academic examiner. ${rubric}\nReturn ONLY valid JSON with this exact shape: {"overallScore":0,"skillScores":{"grammar":0,"vocabulary":0,"coherence":0,"fluency":0,"taskResponse":0},"strengths":[],"improvements":[],"grammar":[],"vocabulary":[],"coherence":[],"fluency":[],"pronunciation":[],"nextSteps":[],"disclaimer":"","bands":{"ielts":null,"pte":null},"annotations":[{"start":0,"end":0,"original":"","correction":"","better":"","category":"","note":"","severity":"low"}],"modelAnswer":null,"advice":null}. skillScores values and overallScore must be 0-100. bands.ielts is 0-9, bands.pte is 0-90; set to null unless confident (formative estimate only, never an official score). annotations are inline corrections that cover EVERY noticeable mistake in the student response: grammar (articles, prepositions, tenses, subject-verb agreement, word order), vocabulary/word choice, spelling, punctuation, coherence/linking, and task response. start/end must be the exact character offsets of the mistake inside the student response so the substring from start to end equals original; original is the mistaken text, correction is the minimal fix, better is an optional stronger alternative, category is one of grammar/vocabulary/coherence/fluency/task_response/spelling/punctuation, note explains the rule or why the correction is better, severity (low/medium/high) reflects impact on the band. modelAnswer is an optional concise model response of at most 80 words written to the task prompt; advice is concise personalized study advice of at most 50 words. Keep each array to at most 4 concise items; annotations up to 12. Do not invent facts. This is formative feedback, not an official IELTS/PTE score.\n${prompt ? `Task prompt: ${prompt}\n` : ""}Student ${type.toLowerCase()} response:\n${normalized}`;
  let response: Response;
  try {
    response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` }, body: JSON.stringify(DISABLE_THINKING ? { model: MODEL, input, enable_thinking: false } : { model: MODEL, input }), signal: AbortSignal.timeout(120000) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ApiError(504, "AI feedback is taking too long right now. Please try again in a moment.");
    console.error("AI feedback request failed", error instanceof Error ? error.message : error);
    throw new ApiError(502, "AI feedback service is temporarily unavailable");
  }
  if (!response.ok) { console.error("AI feedback request failed", response.status); throw new ApiError(502, "AI feedback service is temporarily unavailable"); }
  const output = extractOutputText(await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> });
  if (!output) throw new ApiError(502, "AI feedback returned no result");
  const feedback = parseJson(output, normalized.length); feedback.disclaimer ||= "AI-generated formative feedback; not an official IELTS/PTE score."; return feedback;
}

export async function createAIFeedback(studentId: string, type: FeedbackType, text: string, prompt?: string, context?: { attemptId?: string | null; examId?: string | null; questionId?: string | null }): Promise<AiFeedback & { id: string; createdAt: Date }> {
  const feedback = await evaluateLanguage(type, text, prompt);
  const saved = await AIFeedback.create({ studentId, type, prompt: prompt || null, submission: text.trim(), ...feedback, providerModel: MODEL, attemptId: context?.attemptId || null, examId: context?.examId || null, questionId: context?.questionId || null });
  await updateLearningProfile(studentId, feedback.skillScores);
  return { ...feedback, id: String(saved._id), createdAt: saved.createdAt };
}

export interface AttemptQuestionFeedback {
  questionId: string;
  questionTitle: string;
  prompt: string | null;
  answer: string;
  feedback: AiFeedback & { id: string; createdAt: Date } | null;
  error: string | null;
  reused: boolean;
}

export interface AttemptAICheckResult {
  attemptId: string;
  examId: string;
  examTitle: string;
  questions: AttemptQuestionFeedback[];
}

const WRITING_QUESTION_TYPES = new Set(["ESSAY", "LETTER", "SUMMARIZE_WRITTEN_TEXT"]);

function feedbackShape(doc: Record<string, unknown>): AiFeedback & { id: string; createdAt: Date } {
  const { _id, createdAt, ...rest } = doc;
  return { ...(rest as unknown as AiFeedback), id: String(_id), createdAt: new Date(createdAt as string) };
}

export async function checkAttemptWithAI(studentId: string, attemptId: string): Promise<AttemptAICheckResult> {
  const attempt = await ExamAttempt.findOne({ _id: attemptId, studentId });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (!["SUBMITTED", "UNDER_REVIEW", "GRADED", "PUBLISHED"].includes(attempt.status)) {
    throw new ApiError(400, "Submit the attempt before requesting AI feedback");
  }
  const exam = await Exam.findById(attempt.examId).select("title sections questionIds").lean();
  if (!exam) throw new ApiError(404, "Exam not found");

  const orderedIds = [...exam.sections.flatMap((s) => s.questionIds ?? []), ...(exam.questionIds ?? [])].map(String);
  const answers = await ExamAnswer.find({ attemptId, answered: true }).lean();
  const qids = answers.filter((a) => typeof a.answer === "string" && a.answer.trim().length > 0).map((a) => a.questionId);
  const questions = qids.length ? await Question.find({ _id: { $in: qids } }).select("type title instructions maxWordLimit minWordLimit").lean() : [];
  const qByTitle = new Map(questions.map((q) => [String(q._id), q]));

  const existing = qids.length
    ? await AIFeedback.find({ attemptId, questionId: { $in: qids } }).select("questionId prompt submission overallScore skillScores bands annotations modelAnswer advice strengths improvements grammar vocabulary coherence fluency pronunciation nextSteps disclaimer providerModel createdAt").lean()
    : [];
  const existingByQ = new Map(existing.map((doc) => [String(doc.questionId), doc]));

  const work: AttemptQuestionFeedback[] = [];
  for (const qid of orderedIds.length ? orderedIds : qids.map(String)) {
    const answer = answers.find((a) => String(a.questionId) === qid);
    if (!answer || typeof answer.answer !== "string") continue;
    const text = answer.answer.trim();
    if (text.length < 20) continue;
    const question = qByTitle.get(qid);
    if (!question || !WRITING_QUESTION_TYPES.has(String(question.type))) continue;
    const parts = [question.title, question.instructions].filter(Boolean);
    if (question.minWordLimit || question.maxWordLimit) {
      parts.push(`Word limit: ${question.minWordLimit ? `minimum ${question.minWordLimit}` : ""}${question.minWordLimit && question.maxWordLimit ? "-" : ""}${question.maxWordLimit ? `maximum ${question.maxWordLimit}` : ""}`);
    }
    const prompt = parts.length ? parts.join("\n") : null;
    const cached = existingByQ.get(qid);
    work.push(cached
      ? { questionId: qid, questionTitle: question.title, prompt, answer: text, feedback: feedbackShape(cached), error: null, reused: true }
      : { questionId: qid, questionTitle: question.title, prompt, answer: text, feedback: null, error: null, reused: false });
  }

  await Promise.all(work.filter((w) => !w.reused).map(async (w) => {
    try {
      const feedback = await createAIFeedback(studentId, "WRITING", w.answer.slice(0, 12000), w.prompt ?? undefined, { attemptId, examId: String(attempt.examId), questionId: w.questionId });
      w.feedback = feedback;
      w.error = null;
    } catch (error) {
      console.error("Attempt AI check failed for question", w.questionId, error instanceof Error ? error.message : error);
      w.error = error instanceof ApiError ? error.message : "AI feedback service is temporarily unavailable";
    }
  }));

  if (work.length > 0 && work.every((w) => w.error)) throw new ApiError(502, "AI feedback service is temporarily unavailable. Please try again in a moment.");

  return { attemptId: String(attempt._id), examId: String(attempt.examId), examTitle: exam.title, questions: work };
}

export async function listAIFeedback(studentId: string, limit = 20) {
  const docs = await AIFeedback.find({ studentId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).select("type prompt submission overallScore skillScores bands annotations modelAnswer advice strengths improvements grammar vocabulary coherence fluency pronunciation nextSteps disclaimer providerModel createdAt").lean();
  return docs.map((doc) => ({ ...doc, id: String(doc._id) }));
}

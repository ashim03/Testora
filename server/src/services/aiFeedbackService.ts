import { AIFeedback, ExamAnswer, ExamAttempt, Exam, LearningProfile, Question } from "../models";
import type { ISkillMastery } from "../models/LearningProfile";
import type { AiAnalysisResult, AiErrorAnnotation, AIFeedbackType } from "@testora-platform/shared";
import { ApiError } from "../utils/helpers";

export type FeedbackType = AIFeedbackType;
export type AiFeedback = AiAnalysisResult;
export type WritingRubricVariant = "TASK2_ESSAY" | "GT_LETTER" | "ACADEMIC_TASK1" | "PTE_SUMMARIZE" | "GENERAL";
const ANNOTATION_SEVERITIES = new Set(["low", "medium", "high"]);

/**
 * Detects the writing task type from the prompt so each task is scored with
 * its own official criteria instead of one generic essay rubric.
 */
export function writingRubricVariant(prompt: string | null | undefined): WritingRubricVariant {
  const text = (prompt || "").toLowerCase();
  if (/summaris|summarize/.test(text) && /one sentence|single sentence/.test(text)) return "PTE_SUMMARIZE";
  if (/letter|general training task 1|gt task 1/.test(text)) return "GT_LETTER";
  if (/task 1|chart|graph|table|map|process|diagram/.test(text)) return "ACADEMIC_TASK1";
  return "TASK2_ESSAY";
}

const WRITING_RUBRICS: Record<Exclude<WritingRubricVariant, "GENERAL">, string> = {
  TASK2_ESSAY: "Evaluate as an IELTS/PTE Academic writing examiner using official band descriptors: Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy (IELTS bands 0-9); for PTE Academic use content, form, vocabulary, grammar, and spelling criteria (PTE 0-90). Task Response must be scored against the task prompt: a response that ignores the prompt or wanders off topic must receive a low taskResponse (0-100) regardless of how fluent or accurate the language is.",
  GT_LETTER: "Evaluate as an IELTS General Training Task 1 letter examiner using official band descriptors: Task Achievement (purpose of the letter, appropriate tone — formal or informal as required, correct letter format, and coverage of ALL bullet points in the task), Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy (IELTS bands 0-9). A letter that ignores the required bullet points or uses the wrong tone must receive a low taskResponse (0-100).",
  ACADEMIC_TASK1: "Evaluate as an IELTS Academic Task 1 writing examiner using official band descriptors: Task Achievement (a clear overview, key features or trends reported accurately, no personal opinion, approximately 150 words), Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy (IELTS bands 0-9). A response that describes the wrong data, gives an opinion, or omits an overview must receive a low taskResponse (0-100).",
  PTE_SUMMARIZE: "Evaluate as a PTE Academic Summarize Written Text examiner: content (ALL key points of the passage captured, no invented ideas), form (exactly ONE sentence of 5-75 words), vocabulary, and grammar (PTE 0-90). PTE content uses partial credit: a summary that misses a key point must not score more than 65 content, and one that misses the main idea or invents ideas must not score more than 45. Do not award near-perfect scores (85+) to a single 25-word sentence; reserve the top of the scale for a comprehensive, accurate, well-structured single-sentence summary that captures every key point. A summary that omits key points, invents ideas, or spans multiple sentences must receive a low taskResponse (0-100).",
};

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

export function buildScoringInput(type: FeedbackType, text: string, prompt?: string, measured?: { wpm: number; fillerWordCount: number; pauseFrequencyPerMinute: number; words: number } | null): string {
  const normalized = text.trim();
  const variant = type === "WRITING" ? writingRubricVariant(prompt) : "GENERAL";
  const rubric = type === "WRITING"
    ? `${WRITING_RUBRICS[variant === "GENERAL" ? "TASK2_ESSAY" : variant]} Calibrate every skillScore and the overall score (0-100) against the band scales, and set bands.ielts (0-9, half bands allowed like 6.5) and bands.pte (0-90) whenever confident, otherwise null.`
    : "Evaluate as an IELTS/PTE speaking examiner from the supplied transcript. Assess ONLY what the text can show: Lexical Resource, Grammatical Range & Accuracy, and Fluency & Coherence as far as it is visible in the transcript (cohesion, idea development, repetition, false starts, fillers). IELTS Pronunciation and PTE pronunciation/oral-fluency must be judged from the measured delivery metrics when provided — never guess pace, pauses, or pronunciation from text. PTE Academic content and oral criteria apply. For short structured tasks (describing a graph or image, retelling a lecture, answering a single question), apply a realistic ceiling: a 30-45 second response, however accurate, should rarely exceed IELTS 7.5 / PTE 75, because band descriptors reserve 8+ for sustained, flexible use of language over a longer response. Calibrate every skillScore and the overall score (0-100) against the band scales, and set bands.ielts (0-9, half bands allowed like 6.5) and bands.pte (0-90) whenever confident, otherwise null. Score how fully the response addresses the task prompt and stays on topic into skillScores.taskResponse (0-100); set it to null if no task prompt is provided.";
  return `You are an IELTS/PTE Academic examiner. ${rubric}\nCalibration anchors for strict scoring:\n- Band 6.5: task is answered with some development, basic cohesion, mostly simple sentences, errors that do not impede meaning, limited topic vocabulary.\n- Band 7.5: task fully addressed, clear structure with linking devices, mix of simple and complex structures, good collocations, only rare minor errors.\n- Band 8.5: ideas developed fully and naturally, sophisticated cohesion, wide precise vocabulary with natural collocations, wide grammatical range with only occasional slips.\nScore against the descriptors, not the elegance of the prose: a competent but simple answer is Band 6-6.5, never Band 7.5+. Each skillScore must be consistent with the band you assign for that criterion. Return ONLY valid JSON with this exact shape: {"overallScore":0,"skillScores":{"grammar":0,"vocabulary":0,"coherence":0,"fluency":0,"taskResponse":0},"strengths":[],"improvements":[],"grammar":[],"vocabulary":[],"coherence":[],"fluency":[],"pronunciation":[],"nextSteps":[],"disclaimer":"","bands":{"ielts":null,"pte":null},"annotations":[{"start":0,"end":0,"original":"","correction":"","better":"","category":"","note":"","severity":"low"}],"modelAnswer":null,"advice":null}. skillScores values and overallScore must be 0-100. bands.ielts is 0-9, bands.pte is 0-90; set to null unless confident (formative estimate only, never an official score). annotations are inline corrections that cover EVERY noticeable mistake in the student response: grammar (articles, prepositions, tenses, subject-verb agreement, word order), vocabulary/word choice, spelling, punctuation, coherence/linking, and task response. start/end must be the exact character offsets of the mistake inside the student response so the substring from start to end equals original; original is the mistaken text, correction is the minimal fix, better is an optional stronger alternative, category is one of grammar/vocabulary/coherence/task-response, severity is low/medium/high, and note is a brief explanation. Advice and nextSteps up to at most 4 concise items; annotations up to 12. Do not invent facts. This is formative feedback, not an official IELTS/PTE score.\n${prompt ? `Task prompt: ${prompt}\n` : ""}${measured ? `Measured delivery metrics (from the recording, ground truth for pace/pause judgments): ${measured.words} words at ${measured.wpm} WPM, ${measured.fillerWordCount} filler words, ${measured.pauseFrequencyPerMinute} estimated pauses per minute.\n` : ""}Student ${type.toLowerCase()} response:\n${normalized}`;
}

export async function evaluateLanguage(type: FeedbackType, text: string, prompt?: string, measured?: { wpm: number; fillerWordCount: number; pauseFrequencyPerMinute: number; words: number } | null): Promise<AiFeedback> {
  if (!process.env.AI_API_KEY) throw new ApiError(503, "AI feedback is not configured");
  const normalized = text.trim();
  if (normalized.length < 20) throw new ApiError(400, "Response is too short for meaningful feedback");
  if (normalized.length > 12000) throw new ApiError(400, "Response exceeds the 12,000 character limit");
  const input = buildScoringInput(type, normalized, prompt, measured);
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

const WRITING_ACTION_TEMPLATES: Record<string, string> = {
  taskResponse: "Strengthen task response: fully address every part of the prompt and keep your position clear.",
  coherence: "Improve coherence: link paragraphs and ideas with varied cohesive devices.",
  vocabulary: "Expand lexical range: use less common, topic-specific vocabulary.",
  grammar: "Sharpen grammar: review the inline corrections and practice the patterns you missed.",
  fluency: "Develop ideas more fully: build each point before moving to the next.",
};

function deriveTopActions(skillScores: Record<string, number>): string[] {
  const ranked = (Object.keys(WRITING_ACTION_TEMPLATES) as Array<keyof typeof WRITING_ACTION_TEMPLATES>)
    .filter((skill) => typeof skillScores[skill] === "number")
    .sort((a, b) => skillScores[a] - skillScores[b])
    .slice(0, 3);
  return ranked.map((skill) => WRITING_ACTION_TEMPLATES[skill]);
}

export const OFF_TOPIC_THRESHOLD = 40;

/**
 * Enforces topic adherence for writing deterministically: the overall score
 * is recomputed from the four IELTS writing criteria (task response weighted
 * equally with coherence, vocabulary, and grammar), and an off-topic response
 * gets its bands capped so it cannot earn a high score purely on language
 * quality. Mirrors the speaking behaviour in mergeSpeakingScores.
 */
export function applyWritingTaskResponse(feedback: AiFeedback, prompt: string | null | undefined, variant?: WritingRubricVariant): { feedback: AiFeedback; offTopic: boolean; taskResponseNote: string | null } {
  const hasPrompt = Boolean(prompt?.trim());
  const resolvedVariant = variant ?? writingRubricVariant(prompt);
  const taskResponse = typeof feedback.skillScores.taskResponse === "number" ? clamp(feedback.skillScores.taskResponse) : null;
  if (!hasPrompt || taskResponse === null) {
    return { feedback, offTopic: false, taskResponseNote: null };
  }
  const weights: Array<[string, number]> = [["taskResponse", 0.25], ["coherence", 0.25], ["vocabulary", 0.25], ["grammar", 0.25]];
  let weighted = 0;
  let weightSum = 0;
  for (const [key, weight] of weights) {
    const value = feedback.skillScores[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      weighted += clamp(value) * weight;
      weightSum += weight;
    }
  }
  const overallScore = weightSum > 0 ? clamp(weighted / weightSum) : feedback.overallScore;
  const offTopic = taskResponse < OFF_TOPIC_THRESHOLD;
  let bands = feedback.bands;
  if (bands) {
    let cappedIelts = bands.ielts;
    let cappedPte = bands.pte;
    // Off-topic responses are capped by their task response band.
    if (offTopic) {
      cappedIelts = cappedIelts !== null ? Math.min(cappedIelts, Math.max(1, Math.round((taskResponse / 100) * 9 * 2) / 2)) : null;
      cappedPte = cappedPte !== null ? Math.min(cappedPte, Math.max(10, Math.round(taskResponse * 0.9))) : null;
    }
    // PTE Summarize Written Text responses have a hard ceiling: even a
    // flawless single sentence is a limited task, so bands never exceed
    // IELTS 8 / PTE 80.
    if (resolvedVariant === "PTE_SUMMARIZE") {
      cappedIelts = cappedIelts !== null ? Math.min(cappedIelts, 8) : null;
      cappedPte = cappedPte !== null ? Math.min(cappedPte, 80) : null;
    }
    if (cappedIelts !== bands.ielts || cappedPte !== bands.pte) {
      bands = { ielts: cappedIelts, pte: cappedPte };
    }
  }
  return {
    feedback: { ...feedback, overallScore, bands },
    offTopic,
    taskResponseNote: offTopic ? "Your response appears to have gone off topic, which lowered your overall score." : null,
  };
}

export async function createAIFeedback(studentId: string, type: FeedbackType, text: string, prompt?: string, context?: { attemptId?: string | null; examId?: string | null; questionId?: string | null }): Promise<AiFeedback & { id: string; createdAt: Date; topActions?: string[]; offTopic?: boolean; taskResponseNote?: string | null }> {
  const hasPrompt = Boolean(prompt?.trim());
  let feedback = await evaluateLanguage(type, text, prompt);
  let offTopic = false;
  let taskResponseNote: string | null = null;
  if (type === "WRITING") {
    const result = applyWritingTaskResponse(feedback, prompt);
    feedback = result.feedback;
    offTopic = result.offTopic;
    taskResponseNote = result.taskResponseNote;
  }
  const topActions = type === "WRITING" ? deriveTopActions(feedback.skillScores) : [];
  const saved = await AIFeedback.create({ studentId, type, prompt: prompt || null, submission: text.trim(), ...feedback, topActions, offTopic, taskResponseNote, providerModel: MODEL, attemptId: context?.attemptId || null, examId: context?.examId || null, questionId: context?.questionId || null });
  await updateLearningProfile(studentId, feedback.skillScores);
  return { ...feedback, topActions, offTopic, taskResponseNote, id: String(saved._id), createdAt: saved.createdAt };
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
  return runAttemptAICheck(attempt, studentId);
}

/**
 * Teacher-scoped variant of checkAttemptWithAI: allows a teacher to run (or
 * reuse) AI feedback for a submitted attempt on an exam they created, e.g.
 * while grading. Feedback is still attributed to the student.
 */
export async function checkAttemptWithAITeacher(teacherId: string, attemptId: string): Promise<AttemptAICheckResult> {
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  const exam = await Exam.findById(attempt.examId).select("createdBy").lean();
  if (!exam) throw new ApiError(404, "Exam not found");
  if (String(exam.createdBy) !== teacherId) throw new ApiError(403, "You can only review attempts on exams you created");
  return runAttemptAICheck(attempt, String(attempt.studentId));
}

async function runAttemptAICheck(attempt: InstanceType<typeof ExamAttempt>, studentId: string): Promise<AttemptAICheckResult> {
  const attemptId = String(attempt._id);
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
    ? await AIFeedback.find({ attemptId, questionId: { $in: qids } }).select("questionId prompt submission overallScore skillScores bands annotations modelAnswer advice topActions offTopic taskResponseNote strengths improvements grammar vocabulary coherence fluency pronunciation nextSteps disclaimer providerModel createdAt").lean()
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

  return { attemptId, examId: String(attempt.examId), examTitle: exam.title, questions: work };
}

export async function listAIFeedback(studentId: string, limit = 20) {
  const docs = await AIFeedback.find({ studentId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).select("type prompt submission overallScore skillScores bands annotations modelAnswer advice topActions offTopic taskResponseNote strengths improvements grammar vocabulary coherence fluency pronunciation nextSteps disclaimer providerModel createdAt").lean();
  return docs.map((doc) => ({ ...doc, id: String(doc._id) }));
}

import { AIFeedback } from "../models/AIFeedback";
import { ApiError } from "../utils/helpers";

export type FeedbackType = "WRITING" | "SPEAKING";
export interface AiFeedback { overallScore: number; strengths: string[]; improvements: string[]; grammar: string[]; vocabulary: string[]; coherence: string[]; fluency: string[]; pronunciation: string[]; nextSteps: string[]; disclaimer: string; }

const MODEL = process.env.AI_MODEL || "qwen-plus";
const BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const API_URL = `${BASE_URL}/responses`;

function extractOutputText(payload: { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }): string {
  return (payload.output || []).filter((item) => item.type === "message").flatMap((item) => item.content || []).filter((part) => part.type === "output_text" && part.text).map((part) => part.text as string).join("\n").trim();
}
function parseJson(text: string): AiFeedback {
  try { const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim()) as AiFeedback; if (typeof parsed.overallScore !== "number" || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.improvements)) throw new Error(); return parsed; } catch { throw new ApiError(502, "AI feedback returned an invalid response"); }
}

export async function evaluateLanguage(type: FeedbackType, text: string, prompt?: string): Promise<AiFeedback> {
  if (!process.env.AI_API_KEY) throw new ApiError(503, "AI feedback is not configured");
  const normalized = text.trim();
  if (normalized.length < 20) throw new ApiError(400, "Response is too short for meaningful feedback");
  if (normalized.length > 12000) throw new ApiError(400, "Response exceeds the 12,000 character limit");
  const rubric = type === "WRITING" ? "Evaluate grammar, vocabulary, coherence/cohesion, task response, and organization." : "Evaluate grammar, vocabulary, coherence, fluency, and speaking delivery from the supplied transcript. Do not claim to assess pronunciation from text alone.";
  const input = `You are an English-learning assessment assistant. ${rubric}\nReturn ONLY valid JSON with this exact shape: {"overallScore":0,"strengths":[],"improvements":[],"grammar":[],"vocabulary":[],"coherence":[],"fluency":[],"pronunciation":[],"nextSteps":[],"disclaimer":""}. overallScore must be 0-100. Keep each array to at most 4 concise items. Do not invent facts. This is formative feedback, not an official IELTS/PTE score.\n${prompt ? `Task prompt: ${prompt}\n` : ""}Student ${type.toLowerCase()} response:\n${normalized}`;
  const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` }, body: JSON.stringify({ model: MODEL, input }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) { console.error("AI feedback request failed", response.status); throw new ApiError(502, "AI feedback service is temporarily unavailable"); }
  const output = extractOutputText(await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> });
  if (!output) throw new ApiError(502, "AI feedback returned no result");
  const feedback = parseJson(output); feedback.disclaimer ||= "AI-generated formative feedback; not an official IELTS/PTE score."; return feedback;
}

export async function createAIFeedback(studentId: string, type: FeedbackType, text: string, prompt?: string): Promise<AiFeedback & { id: string; createdAt: Date }> {
  const feedback = await evaluateLanguage(type, text, prompt);
  const saved = await AIFeedback.create({ studentId, type, prompt: prompt || null, submission: text.trim(), ...feedback, model: MODEL });
  return { ...feedback, id: String(saved._id), createdAt: saved.createdAt };
}

export async function listAIFeedback(studentId: string, limit = 20) {
  return AIFeedback.find({ studentId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).select("type prompt submission overallScore strengths improvements grammar vocabulary coherence fluency pronunciation nextSteps disclaimer model createdAt").lean();
}

import XLSX from "xlsx";
import { Question } from "../models/Question";
import { ApiError } from "../utils/helpers";
import { QUESTION_CATEGORIES, QUESTION_TYPES } from "@testora-platform/shared";

const HEADERS = ["category", "type", "title", "instructions", "passage", "topic", "options", "correctAnswers", "acceptedAnswers", "marks", "negativeMarks", "difficulty", "explanation", "tags", "maxWordLimit", "minWordLimit", "isPublic"] as const;
const MAX_IMPORT_ROWS = 1000;
type Row = Record<string, unknown>;
const text = (value: unknown): string => value == null ? "" : String(value).trim();
const list = (value: unknown): string[] => text(value).split("|").map((v) => v.trim()).filter(Boolean);
const bool = (value: unknown): boolean => ["true", "1", "yes", "y"].includes(text(value).toLowerCase());
const number = (value: unknown, fallback: number): number => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };

function normalizeRow(row: Row, teacherId: string, rowNumber: number) {
  const category = text(row.category).toUpperCase();
  const type = text(row.type).toUpperCase();
  const difficulty = text(row.difficulty).toUpperCase() || "MEDIUM";
  if (!(QUESTION_CATEGORIES as readonly string[]).includes(category)) throw new ApiError(400, `Row ${rowNumber}: invalid category`);
  if (!(QUESTION_TYPES as readonly string[]).includes(type)) throw new ApiError(400, `Row ${rowNumber}: invalid question type`);
  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) throw new ApiError(400, `Row ${rowNumber}: invalid difficulty`);
  const title = text(row.title);
  if (!title) throw new ApiError(400, `Row ${rowNumber}: title is required`);
  const options = list(row.options).map((item) => { const [key, ...parts] = item.split(":"); return { key: key.trim(), text: parts.join(":").trim() }; }).filter((o) => o.key && o.text);
  return { createdBy: teacherId, category, type, title, instructions: text(row.instructions), passage: text(row.passage), topic: text(row.topic), options, correctAnswers: list(row.correctAnswers), acceptedAnswers: list(row.acceptedAnswers), marks: Math.min(100, Math.max(0, number(row.marks, 1))), negativeMarks: Math.min(10, Math.max(0, number(row.negativeMarks, 0))), difficulty, explanation: text(row.explanation), tags: list(row.tags), maxWordLimit: text(row.maxWordLimit) === "" ? null : number(row.maxWordLimit, 0), minWordLimit: text(row.minWordLimit) === "" ? null : number(row.minWordLimit, 0), isPublic: bool(row.isPublic) };
}

export async function exportQuestions(teacherId: string, format: "csv" | "xlsx") {
  const questions = await Question.find({ createdBy: teacherId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  const rows = questions.map((q) => ({ category: q.category, type: q.type, title: q.title, instructions: q.instructions, passage: q.passage, topic: q.topic, options: (q.options || []).map((o) => `${o.key}:${o.text}`).join("|"), correctAnswers: (q.correctAnswers || []).join("|"), acceptedAnswers: (q.acceptedAnswers || []).join("|"), marks: q.marks, negativeMarks: q.negativeMarks, difficulty: q.difficulty, explanation: q.explanation || "", tags: (q.tags || []).join("|"), maxWordLimit: q.maxWordLimit ?? "", minWordLimit: q.minWordLimit ?? "", isPublic: !!q.isPublic }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  if (format === "xlsx") { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Questions"); return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "testora-question-bank.xlsx" }; }
  return { buffer: Buffer.from(XLSX.utils.sheet_to_csv(sheet), "utf8"), contentType: "text/csv; charset=utf-8", filename: "testora-question-bank.csv" };
}

export async function importQuestions(teacherId: string, file: Express.Multer.File) {
  if (!file || file.size > 10 * 1024 * 1024) throw new ApiError(400, "Upload a CSV/XLSX file up to 10MB");
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ApiError(400, "The workbook has no sheets");
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  if (rows.length > MAX_IMPORT_ROWS) throw new ApiError(400, `Import is limited to ${MAX_IMPORT_ROWS} questions per file`);
  const errors: string[] = [];
  const valid: ReturnType<typeof normalizeRow>[] = [];
  rows.forEach((row, index) => { try { valid.push(normalizeRow(row, teacherId, index + 2)); } catch (error) { errors.push(error instanceof Error ? error.message : `Row ${index + 2}: invalid data`); } });
  if (errors.length) return { created: 0, failed: errors.length, errors: errors.slice(0, 50) };
  if (valid.length) await Question.insertMany(valid, { ordered: true });
  return { created: valid.length, failed: 0, errors: [] };
}

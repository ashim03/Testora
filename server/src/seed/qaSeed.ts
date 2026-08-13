import "dotenv/config";
import mongoose, { Types } from "mongoose";
import {
  Assignment,
  AssignmentSubmission,
  Batch,
  Course,
  Exam,
  ExamAnswer,
  ExamAssignment,
  ExamAttempt,
  Grade,
  MediaAsset,
  Passage,
  Question,
  Result,
  StudentProfile,
  TeacherProfile,
  TeacherStudentAssignment,
  User,
} from "../models";
import { hashPassword } from "../utils/tokens";
import { getMediaService } from "../services/mediaService";

const QA_TAG = "QA-SEED";
const QA_PASSWORD = "QaTest@12345";
const qaEmails = [
  "qa.admin@test.com",
  "qa.teacher@test.com",
  "ielts.student@test.com",
  "pte.student@test.com",
];

function requireSafeEnvironment(): void {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to run QA seed with NODE_ENV=production.");
  }
}

async function resetQaData(): Promise<void> {
  const qaUsers = await User.find({ email: { $in: qaEmails } }).select("_id").lean();
  const qaUserIds = qaUsers.map((u) => u._id);
  const qaQuestions = await Question.find({ tags: QA_TAG }).select("_id audioAssetId").lean();
  const qaQuestionIds = qaQuestions.map((q) => q._id);
  const qaExams = await Exam.find({ title: /^\[QA\]/ }).select("_id").lean();
  const qaExamIds = qaExams.map((e) => e._id);
  const qaAttempts = await ExamAttempt.find({ $or: [{ examId: { $in: qaExamIds } }, { studentId: { $in: qaUserIds } }] }).select("_id").lean();
  const qaAttemptIds = qaAttempts.map((a) => a._id);
  const qaAssignments = await Assignment.find({ title: /^\[QA\]/ }).select("_id").lean();
  const qaAssignmentIds = qaAssignments.map((a) => a._id);
  const mediaIds = qaQuestions.map((q) => q.audioAssetId).filter(Boolean);

  await Promise.all([
    ExamAnswer.deleteMany({ $or: [{ attemptId: { $in: qaAttemptIds } }, { questionId: { $in: qaQuestionIds } }] }),
    Result.deleteMany({ $or: [{ attemptId: { $in: qaAttemptIds } }, { studentId: { $in: qaUserIds } }] }),
    Grade.deleteMany({ $or: [{ attemptId: { $in: qaAttemptIds } }, { studentId: { $in: qaUserIds } }] }),
    AssignmentSubmission.deleteMany({ $or: [{ assignmentId: { $in: qaAssignmentIds } }, { studentId: { $in: qaUserIds } }] }),
    ExamAssignment.deleteMany({ $or: [{ examId: { $in: qaExamIds } }, { studentId: { $in: qaUserIds } }] }),
    ExamAttempt.deleteMany({ _id: { $in: qaAttemptIds } }),
    Assignment.deleteMany({ _id: { $in: qaAssignmentIds } }),
    Exam.deleteMany({ _id: { $in: qaExamIds } }),
    Question.deleteMany({ _id: { $in: qaQuestionIds } }),
    Passage.deleteMany({ tags: QA_TAG }),
    Batch.deleteMany({ name: /^\[QA\]/ }),
    Course.deleteMany({ code: { $in: ["QA-IELTS", "QA-PTE"] } }),
    TeacherStudentAssignment.deleteMany({ $or: [{ teacherId: { $in: qaUserIds } }, { studentId: { $in: qaUserIds } }] }),
    StudentProfile.deleteMany({ userId: { $in: qaUserIds } }),
    TeacherProfile.deleteMany({ userId: { $in: qaUserIds } }),
    MediaAsset.deleteMany({ $or: [{ _id: { $in: mediaIds } }, { publicId: /^qa-/ }] }),
  ]);
}

async function ensureUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  role: "SUPER_ADMIN" | "TEACHER" | "STUDENT";
  createdBy?: Types.ObjectId;
}) {
  const passwordHash = await hashPassword(QA_PASSWORD);
  return User.findOneAndUpdate(
    { email: input.email },
    {
      $set: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        status: "ACTIVE",
        passwordHash,
        createdBy: input.createdBy ?? null,
        deletedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function qaQuestion(base: Partial<InstanceType<typeof Question>> & {
  category: string;
  type: string;
  title: string;
  correctAnswers?: string[];
  acceptedAnswers?: string[];
  options?: Array<{ key: string; text: string }>;
  marks?: number;
}) {
  return {
    instructions: "",
    passage: "",
    marks: 1,
    negativeMarks: 0,
    difficulty: "MEDIUM",
    tags: [QA_TAG, base.category, base.type],
    correctAnswers: [],
    acceptedAnswers: [],
    options: [],
    ...base,
  };
}

function makeSilentWav(seconds = 1): Buffer {
  const sampleRate = 8000;
  const bytesPerSample = 2;
  const dataSize = sampleRate * seconds * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(8 * bytesPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function createQaAudio(uploadedBy: Types.ObjectId, name: string): Promise<{ assetId: Types.ObjectId; url: string }> {
  const stored = await getMediaService().upload({
    buffer: makeSilentWav(1),
    mimeType: "audio/wav",
    kind: "AUDIO",
    filename: `qa-${name}.wav`,
    userId: String(uploadedBy),
  });
  return { assetId: new Types.ObjectId(stored.assetId || ""), url: stored.url };
}

async function main(): Promise<void> {
  requireSafeEnvironment();
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ielts_pte_platform";
  await mongoose.connect(uri);
  await resetQaData();

  const admin = await ensureUser({ firstName: "QA", lastName: "Admin", email: "qa.admin@test.com", role: "SUPER_ADMIN" });
  const teacher = await ensureUser({ firstName: "QA", lastName: "Teacher", email: "qa.teacher@test.com", role: "TEACHER", createdBy: admin._id as Types.ObjectId });
  const ieltsStudent = await ensureUser({ firstName: "IELTS Test", lastName: "Student", email: "ielts.student@test.com", role: "STUDENT", createdBy: teacher._id as Types.ObjectId });
  const pteStudent = await ensureUser({ firstName: "PTE Test", lastName: "Student", email: "pte.student@test.com", role: "STUDENT", createdBy: teacher._id as Types.ObjectId });

  await TeacherProfile.create({ userId: teacher._id, qualification: "QA-certified practice workflow tester" });

  const ieltsCourse = await Course.create({
    name: "[QA] IELTS Academic QA Course",
    code: "QA-IELTS",
    type: "IELTS",
    description: "Synthetic IELTS QA course data.",
    instructorId: teacher._id,
    level: "ALL_LEVELS",
  });
  const pteCourse = await Course.create({
    name: "[QA] PTE Academic QA Course",
    code: "QA-PTE",
    type: "PTE",
    description: "Synthetic PTE QA course data.",
    instructorId: teacher._id,
    level: "ALL_LEVELS",
  });

  const ieltsBatch = await Batch.create({ name: "[QA] IELTS Batch", courseId: ieltsCourse._id, teacherId: teacher._id, studentIds: [ieltsStudent._id] });
  const pteBatch = await Batch.create({ name: "[QA] PTE Batch", courseId: pteCourse._id, teacherId: teacher._id, studentIds: [pteStudent._id] });

  await Promise.all([
    StudentProfile.create({ userId: ieltsStudent._id, currentTeacherId: teacher._id, currentBatchId: ieltsBatch._id, examType: "IELTS", targetScore: "7.0", currentLevel: "Intermediate" }),
    StudentProfile.create({ userId: pteStudent._id, currentTeacherId: teacher._id, currentBatchId: pteBatch._id, examType: "PTE", targetScore: "65", currentLevel: "Intermediate" }),
    TeacherStudentAssignment.create({ teacherId: teacher._id, studentId: ieltsStudent._id, assignedBy: admin._id, status: "ACTIVE" }),
    TeacherStudentAssignment.create({ teacherId: teacher._id, studentId: pteStudent._id, assignedBy: admin._id, status: "ACTIVE" }),
  ]);

  const teacherId = teacher._id as Types.ObjectId;
  const qAudio = await createQaAudio(teacherId, "question");
  const studentAudio = await createQaAudio(ieltsStudent._id as Types.ObjectId, "student-answer");

  const ieltsPassage = await Passage.create({
    title: "[QA] Community Libraries",
    category: "IELTS_READING",
    content: "Community libraries provide quiet study spaces, digital resources, and local workshops. Although many people now read online, libraries remain important because they support students, job seekers, and older residents. In several towns, volunteer programmes have helped libraries extend evening opening hours.",
    createdBy: teacherId,
    tags: [QA_TAG],
  });
  const ptePassage = await Passage.create({
    title: "[QA] Urban Transport",
    category: "PTE_READING",
    content: "Reliable public transport reduces traffic congestion and can improve air quality. Cities that invest in frequent buses and safe train services often report shorter commuting times and higher satisfaction among residents.",
    createdBy: teacherId,
    tags: [QA_TAG],
  });

  const ieltsReadingTypes = ["SINGLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "MATCHING_HEADINGS", "FILL_BLANK", "SHORT_ANSWER"] as const;
  const questionInputs = [
    ...Array.from({ length: 10 }, (_, i) => qaQuestion({
      category: "IELTS_LISTENING",
      type: i % 3 === 0 ? "SINGLE_CHOICE" : i % 3 === 1 ? "FILL_BLANK" : "MULTIPLE_ANSWER",
      title: `[QA] IELTS Listening ${i + 1}: identify the correct detail`,
      passage: "The speaker says the workshop begins at nine thirty and students should bring headphones.",
      audioUrl: qAudio.url,
      audioAssetId: qAudio.assetId,
      audioDuration: 1,
      audioPlayRules: { maxPlays: null, allowSeek: true },
      options: [{ key: "A", text: "Nine thirty" }, { key: "B", text: "Ten forty" }, { key: "C", text: "A notebook" }, { key: "D", text: "Headphones" }],
      correctAnswers: i % 3 === 2 ? ["A", "D"] : ["A"],
      difficulty: i < 3 ? "EASY" : i < 7 ? "MEDIUM" : "HARD",
      })),
    ...Array.from({ length: 10 }, (_, i) => qaQuestion({
      category: "IELTS_READING",
      type: ieltsReadingTypes[i % ieltsReadingTypes.length],
      title: `[QA] IELTS Reading ${i + 1}: community libraries`,
      passageId: ieltsPassage._id,
      passage: ieltsPassage.content,
      options: [{ key: "A", text: "They support local residents" }, { key: "B", text: "They are used only by children" }, { key: "TRUE", text: "True" }, { key: "FALSE", text: "False" }, { key: "NOT_GIVEN", text: "Not Given" }],
      correctAnswers: i % 5 === 1 ? ["TRUE"] : ["A"],
      acceptedAnswers: ["libraries", "community libraries"],
      difficulty: i < 3 ? "EASY" : i < 7 ? "MEDIUM" : "HARD",
    })),
    qaQuestion({ category: "IELTS_WRITING", type: "LETTER", title: "[QA] IELTS Writing Task 1 letter with special chars", instructions: "Write 150+ words. Include punctuation: commas, apostrophes, and parentheses.", minWordLimit: 150, maxWordLimit: 220, marks: 9, difficulty: "MEDIUM" }),
    qaQuestion({ category: "IELTS_WRITING", type: "ESSAY", title: "[QA] IELTS Writing Task 2 long essay prompt", instructions: "Some people believe online learning is more effective than classroom learning. Discuss both views and give your opinion.", minWordLimit: 250, maxWordLimit: 400, marks: 9, difficulty: "HARD" }),
    qaQuestion({ category: "IELTS_SPEAKING", type: "SPEAKING_RESPONSE", title: "[QA] IELTS Speaking Part 1", instructions: "Record a short answer about your study habits.", marks: 9, difficulty: "EASY" }),
    qaQuestion({ category: "IELTS_SPEAKING", type: "SPEAKING_RESPONSE", title: "[QA] IELTS Speaking Part 2 cue card", instructions: "Describe a useful app you use for learning.", marks: 9, difficulty: "MEDIUM" }),
    qaQuestion({ category: "IELTS_SPEAKING", type: "SPEAKING_RESPONSE", title: "[QA] IELTS Speaking Part 3", instructions: "Discuss whether technology has changed education.", marks: 9, difficulty: "HARD" }),
    qaQuestion({ category: "PTE_SPEAKING", type: "READ_ALOUD", title: "[QA] PTE Read Aloud", passage: "Public libraries help communities learn and connect.", marks: 5 }),
    qaQuestion({ category: "PTE_SPEAKING", type: "REPEAT_SENTENCE", title: "[QA] PTE Repeat Sentence", passage: "The lecture starts after the lunch break.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, marks: 5 }),
    qaQuestion({ category: "PTE_SPEAKING", type: "DESCRIBE_IMAGE", title: "[QA] PTE Describe Image", imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='220'%3E%3Crect width='400' height='220' fill='%23eff6ff'/%3E%3Crect x='70' y='90' width='50' height='90' fill='%232563eb'/%3E%3Crect x='170' y='55' width='50' height='125' fill='%230d9488'/%3E%3Crect x='270' y='120' width='50' height='60' fill='%23f59e0b'/%3E%3C/svg%3E", marks: 5 }),
    qaQuestion({ category: "PTE_SPEAKING", type: "RETELL_LECTURE", title: "[QA] PTE Retell Lecture", passage: "The speaker explains how sleep supports memory and learning.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, marks: 5 }),
    qaQuestion({ category: "PTE_SPEAKING", type: "ANSWER_SHORT_QUESTION", title: "[QA] PTE Answer Short Question", correctAnswers: ["asia"], acceptedAnswers: ["asia"], marks: 1 }),
    qaQuestion({ category: "PTE_WRITING", type: "SUMMARIZE_WRITTEN_TEXT", title: "[QA] PTE Summarize Written Text", passageId: ptePassage._id, passage: ptePassage.content, minWordLimit: 5, maxWordLimit: 75, marks: 5 }),
    qaQuestion({ category: "PTE_WRITING", type: "ESSAY", title: "[QA] PTE Essay", instructions: "Write 200-300 words about public transport.", minWordLimit: 200, maxWordLimit: 300, marks: 5 }),
    qaQuestion({ category: "PTE_READING", type: "SINGLE_CHOICE", title: "[QA] PTE Reading single answer", passageId: ptePassage._id, passage: ptePassage.content, options: [{ key: "A", text: "Public transport can reduce congestion" }, { key: "B", text: "Cities should remove trains" }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_READING", type: "MULTIPLE_ANSWER", title: "[QA] PTE Reading multiple answers", options: [{ key: "A", text: "Buses can be frequent" }, { key: "B", text: "Transport affects commute time" }, { key: "C", text: "Libraries sell tickets" }], correctAnswers: ["A", "B"] }),
    qaQuestion({ category: "PTE_READING", type: "REORDER_PARAGRAPHS", title: "[QA] PTE Re-order Paragraphs", options: [{ key: "A", text: "First, identify the main topic." }, { key: "B", text: "Next, arrange supporting ideas logically." }, { key: "C", text: "Finally, check the sequence." }], correctAnswers: ["A", "B", "C"] }),
    qaQuestion({ category: "PTE_READING", type: "FILL_BLANK", title: "[QA] PTE Reading fill blank", options: [{ key: "A", text: "congestion" }, { key: "B", text: "celebration" }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "SUMMARIZE_SPOKEN_TEXT", title: "[QA] PTE Summarize Spoken Text", passage: "The speaker says sleep improves memory.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, minWordLimit: 50, maxWordLimit: 70, marks: 5 }),
    qaQuestion({ category: "PTE_LISTENING", type: "SINGLE_CHOICE", title: "[QA] PTE Listening multiple choice", passage: "The museum opens at ten.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, options: [{ key: "A", text: "Ten" }, { key: "B", text: "Nine" }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "FILL_BLANK", title: "[QA] PTE Listening fill blank", passage: "Return the form to the main office.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, options: [{ key: "A", text: "office" }, { key: "B", text: "garden" }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "HIGHLIGHT_CORRECT_SUMMARY", title: "[QA] PTE Highlight Correct Summary", passage: "The talk explains why urban trees reduce heat and improve public spaces.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, options: [{ key: "A", text: "Urban trees can cool streets and improve shared spaces." }, { key: "B", text: "The speaker argues that cities should remove public parks." }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "SELECT_MISSING_WORD", title: "[QA] PTE Select Missing Word", passage: "The speaker says students should submit the form before the final ____.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, options: [{ key: "A", text: "deadline" }, { key: "B", text: "holiday" }], correctAnswers: ["A"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "HIGHLIGHT_INCORRECT_WORDS", title: "[QA] PTE Highlight Incorrect Words", passage: "Transcript with incorrect words: The library closes at seven and opens on Sunday.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, options: [{ key: "A", text: "seven" }, { key: "B", text: "Sunday" }, { key: "C", text: "library" }], correctAnswers: ["A", "B"] }),
    qaQuestion({ category: "PTE_LISTENING", type: "LISTENING_DICTATION", title: "[QA] PTE Write From Dictation", passage: "Please submit your assignment by Friday.", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, correctAnswers: ["please submit your assignment by friday"], acceptedAnswers: ["Please submit your assignment by Friday."], marks: 1 }),
  ];

  const questions = await Question.insertMany(questionInputs.map((q) => ({ ...q, createdBy: teacherId })));
  const byCategory = (category: string) => questions.filter((q) => q.category === category).map((q) => q._id);

  const exams = await Exam.insertMany([
    { createdBy: teacherId, title: "[QA] IELTS Listening Test A", type: "SECTIONAL", category: "IELTS_LISTENING", durationSec: 300, questionIds: byCategory("IELTS_LISTENING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Listening Test B", type: "SECTIONAL", category: "IELTS_LISTENING", durationSec: 300, questionIds: byCategory("IELTS_LISTENING").slice().reverse(), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Reading Test A", type: "SECTIONAL", category: "IELTS_READING", durationSec: 300, questionIds: byCategory("IELTS_READING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Reading Test B", type: "SECTIONAL", category: "IELTS_READING", durationSec: 300, questionIds: byCategory("IELTS_READING").slice().reverse(), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Writing Practice", type: "SECTIONAL", category: "IELTS_WRITING", durationSec: 300, questionIds: byCategory("IELTS_WRITING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Speaking Practice", type: "SECTIONAL", category: "IELTS_SPEAKING", durationSec: 300, questionIds: byCategory("IELTS_SPEAKING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] IELTS Full Mock", type: "MOCK", category: "IELTS_READING", durationSec: 600, sections: [
      { title: "Listening", order: 0, durationSec: 120, questionIds: byCategory("IELTS_LISTENING"), instructions: "QA listening", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, audioDuration: 1, audioPlayRules: { maxPlays: null, allowSeek: true } },
      { title: "Reading", order: 1, durationSec: 120, questionIds: byCategory("IELTS_READING"), instructions: "QA reading" },
      { title: "Writing", order: 2, durationSec: 180, questionIds: byCategory("IELTS_WRITING"), instructions: "QA writing" },
      { title: "Speaking", order: 3, durationSec: 180, questionIds: byCategory("IELTS_SPEAKING"), instructions: "QA speaking" },
    ], attemptLimit: 2, autoSubmit: true, sectionWiseTiming: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] PTE Speaking Practice", type: "SECTIONAL", category: "PTE_SPEAKING", durationSec: 300, questionIds: byCategory("PTE_SPEAKING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] PTE Writing Practice", type: "SECTIONAL", category: "PTE_WRITING", durationSec: 300, questionIds: byCategory("PTE_WRITING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] PTE Reading Practice", type: "SECTIONAL", category: "PTE_READING", durationSec: 300, questionIds: byCategory("PTE_READING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] PTE Listening Practice", type: "SECTIONAL", category: "PTE_LISTENING", durationSec: 300, questionIds: byCategory("PTE_LISTENING"), attemptLimit: 3, autoSubmit: true, status: "PUBLISHED" },
    { createdBy: teacherId, title: "[QA] PTE Full Mock", type: "MOCK", category: "PTE_READING", durationSec: 600, sections: [
      { title: "Speaking", order: 0, durationSec: 120, questionIds: byCategory("PTE_SPEAKING"), instructions: "QA speaking" },
      { title: "Writing", order: 1, durationSec: 120, questionIds: byCategory("PTE_WRITING"), instructions: "QA writing" },
      { title: "Reading", order: 2, durationSec: 180, questionIds: byCategory("PTE_READING"), instructions: "QA reading" },
      { title: "Listening", order: 3, durationSec: 180, questionIds: byCategory("PTE_LISTENING"), instructions: "QA listening", audioUrl: qAudio.url, audioAssetId: qAudio.assetId, audioDuration: 1, audioPlayRules: { maxPlays: null, allowSeek: true } },
    ], attemptLimit: 2, autoSubmit: true, sectionWiseTiming: true, status: "PUBLISHED" },
  ]);

  await Promise.all(exams.flatMap((exam) => [
    ExamAssignment.create({ examId: exam._id, studentId: ieltsStudent._id, teacherId: teacher._id, assignedBy: teacher._id, status: "ASSIGNED" }),
    ExamAssignment.create({ examId: exam._id, studentId: pteStudent._id, teacherId: teacher._id, assignedBy: teacher._id, status: "ASSIGNED" }),
  ]));

  const completed = await ExamAttempt.create({
    examId: exams[2]._id,
    studentId: ieltsStudent._id,
    teacherId: teacher._id,
    attemptNumber: 1,
    startedAt: new Date(Date.now() - 3600000),
    expiresAt: new Date(Date.now() - 1800000),
    submittedAt: new Date(Date.now() - 2400000),
    status: "PUBLISHED",
    objectiveScore: 8,
    rawScore: 8,
    maxScore: 10,
    finalScore: 8,
    practiceBand: 7,
  });
  await Result.create({ attemptId: completed._id, examId: completed.examId, studentId: ieltsStudent._id, teacherId: teacher._id, examTitle: "[QA] IELTS Reading Test A", category: "IELTS_READING", finalScore: 8, rawScore: 8, maxScore: 10, percentage: 80, practiceBand: 7, published: true, publishedBy: teacher._id, publishedAt: new Date() });

  const speakingAttempt = await ExamAttempt.create({
    examId: exams[5]._id,
    studentId: ieltsStudent._id,
    teacherId: teacher._id,
    attemptNumber: 1,
    startedAt: new Date(Date.now() - 2400000),
    expiresAt: new Date(Date.now() - 1200000),
    submittedAt: new Date(Date.now() - 1800000),
    status: "UNDER_REVIEW",
    objectiveScore: 0,
    rawScore: 0,
    maxScore: 27,
  });
  const speakingQuestion = questions.find((q) => q.category === "IELTS_SPEAKING");
  if (speakingQuestion) {
    await ExamAnswer.create({
      attemptId: speakingAttempt._id,
      examId: speakingAttempt.examId,
      studentId: ieltsStudent._id,
      questionId: speakingQuestion._id,
      answer: { url: studentAudio.url, assetId: String(studentAudio.assetId), duration: 1, recordedAt: new Date().toISOString() },
      answered: true,
      isObjective: false,
    });
  }

  await ExamAttempt.create({
    examId: exams[0]._id,
    studentId: ieltsStudent._id,
    teacherId: teacher._id,
    attemptNumber: 1,
    startedAt: new Date(Date.now() - 1200000),
    expiresAt: new Date(Date.now() + 180000),
    status: "IN_PROGRESS",
  });
  await ExamAttempt.create({
    examId: exams[11]._id,
    studentId: pteStudent._id,
    teacherId: teacher._id,
    attemptNumber: 1,
    startedAt: new Date(Date.now() - 7200000),
    expiresAt: new Date(Date.now() - 3600000),
    submittedAt: new Date(Date.now() - 5400000),
    status: "PUBLISHED",
    objectiveScore: 7,
    rawScore: 7,
    maxScore: 10,
    finalScore: 7,
    estimatedPteScore: 63,
  });

  await Assignment.create({
    createdBy: teacher._id,
    title: "[QA] IELTS Writing Task 2 Submission",
    description: "QA writing assignment.",
    instructions: "Submit a 250-word response.",
    questionIds: byCategory("IELTS_WRITING"),
    studentIds: [ieltsStudent._id],
    batchIds: [ieltsBatch._id],
    dueAt: new Date(Date.now() + 7 * 86400000),
    maxMarks: 9,
    status: "ASSIGNED",
    submissionType: "TEXT",
    allowResubmission: true,
    published: true,
  });

  console.log(JSON.stringify({
    status: "ok",
    password: QA_PASSWORD,
    accounts: qaEmails,
    courses: 2,
    batches: 2,
    questions: questions.length,
    exams: exams.length,
    mediaFixtures: 2,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[qa-seed] failed", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

import "dotenv/config";
import mongoose, { type Types } from "mongoose";
import {
  User,
  TeacherProfile,
  StudentProfile,
  TeacherStudentAssignment,
  Course,
  Category,
  Batch,
  Question,
  Passage,
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamAnswer,
  Assignment,
  AssignmentSubmission,
  Grade,
  Result,
} from "../models";
import { hashPassword } from "../utils/tokens";

const reset = process.argv.includes("--reset");

interface QuestionSeed {
  category: string;
  type: string;
  title: string;
  marks: number;
  instructions?: string;
  passage?: string;
  passageId?: Types.ObjectId;
  options?: Array<{ key: string; text: string }>;
  correctAnswers?: string[];
  acceptedAnswers?: string[];
  minWordLimit?: number;
  maxWordLimit?: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  rubric?: Array<{ key: string; label: string; max: number; weight: number }>;
  explanation?: string;
  tags?: string[];
}

const IELTS_WRITING_RUBRIC = [
  { key: "taskResponse", label: "Task Response", max: 9, weight: 25 },
  { key: "coherence", label: "Coherence and Cohesion", max: 9, weight: 25 },
  { key: "lexical", label: "Lexical Resource", max: 9, weight: 25 },
  { key: "grammar", label: "Grammatical Range and Accuracy", max: 9, weight: 25 },
];

const IELTS_SPEAKING_RUBRIC = [
  { key: "fluency", label: "Fluency and Coherence", max: 9, weight: 25 },
  { key: "lexical", label: "Lexical Resource", max: 9, weight: 25 },
  { key: "grammar", label: "Grammatical Range and Accuracy", max: 9, weight: 25 },
  { key: "pronunciation", label: "Pronunciation", max: 9, weight: 25 },
];

const PTE_WRITING_RUBRIC = [
  { key: "content", label: "Content", max: 5, weight: 25 },
  { key: "form", label: "Form", max: 5, weight: 20 },
  { key: "grammar", label: "Grammar", max: 5, weight: 20 },
  { key: "vocabulary", label: "Vocabulary", max: 5, weight: 20 },
  { key: "spelling", label: "Spelling", max: 5, weight: 15 },
];

const PTE_SPEAKING_RUBRIC = [
  { key: "content", label: "Content", max: 5, weight: 25 },
  { key: "oralFluency", label: "Oral Fluency", max: 5, weight: 40 },
  { key: "pronunciation", label: "Pronunciation", max: 5, weight: 35 },
];

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/testora";
  await mongoose.connect(uri);
  console.log(`[seed] connected ${uri}`);

  if (reset) {
    await mongoose.connection.dropDatabase();
    console.log("[seed] database dropped");
  }

  const adminPass = await hashPassword("Admin@12345");
  const admin = await ensureUser({
    firstName: "Super",
    lastName: "Admin",
    email: "admin@example.com",
    role: "SUPER_ADMIN",
    passwordHash: adminPass,
  });

  const t1Pass = await hashPassword("Teacher@12345");
  const teacher1 = await ensureUser({
    firstName: "Alice",
    lastName: "Brown",
    email: "teacher@example.com",
    role: "TEACHER",
    passwordHash: t1Pass,
    createdBy: admin._id,
  });
  const teacher2 = await ensureUser({
    firstName: "Robert",
    lastName: "Green",
    email: "teacher2@example.com",
    role: "TEACHER",
    passwordHash: t1Pass,
    createdBy: admin._id,
  });

  await TeacherProfile.updateOne(
    { userId: teacher1._id },
    { $set: { userId: teacher1._id, qualification: "MA TESOL, IELTS Examiner Trainer" } },
    { upsert: true },
  );
  await TeacherProfile.updateOne(
    { userId: teacher2._id },
    { $set: { userId: teacher2._id, qualification: "PTE Academic Certified Trainer" } },
    { upsert: true },
  );

  await Category.insertMany([
    { name: "General English", code: "GEN", type: "IELTS", description: "Foundation English" },
    { name: "IELTS Academic", code: "IELTS-A", type: "IELTS", description: "Academic module preparation" },
    { name: "PTE Academic", code: "PTE", type: "PTE", description: "PTE preparation" },
  ]);

  const ielts = await Course.create({ name: "IELTS Academic", code: "IELTS", type: "IELTS", description: "IELTS preparation course" });
  const pte = await Course.create({ name: "PTE Academic", code: "PTE", type: "PTE", description: "PTE preparation course" });

  const batchIE = await Batch.create({ name: "IELTS Batch A", courseId: ielts._id, teacherId: teacher1._id, startDate: new Date(), endDate: new Date(Date.now() + 90 * 86400000), studentIds: [] });
  const batchIE2 = await Batch.create({ name: "IELTS Batch B", courseId: ielts._id, teacherId: teacher1._id, startDate: new Date(), endDate: new Date(Date.now() + 60 * 86400000), studentIds: [] });
  const batchPTE = await Batch.create({ name: "PTE Batch C", courseId: pte._id, teacherId: teacher2._id, startDate: new Date(), endDate: new Date(Date.now() + 75 * 86400000), studentIds: [] });

  const studentPass = await hashPassword("Student@12345");
  const studentUsers = [];
  for (let i = 1; i <= 10; i += 1) {
    const teacher = i <= 6 ? teacher1 : teacher2;
    const batch = i <= 6 ? (i % 2 === 0 ? batchIE2 : batchIE) : batchPTE;
    const firstName = i === 1 ? "Demo" : `Student${i}`;
    const email = i === 1 ? "student@example.com" : `student${i}@example.com`;
    const existing = await User.findOne({ email });
    const su = existing
      ? existing
      : await User.create({
          firstName,
          lastName: "Doe",
          email,
          role: "STUDENT",
          passwordHash: studentPass,
          createdBy: i <= 6 ? teacher1._id : teacher2._id,
        });
    await StudentProfile.updateOne(
      { userId: su._id },
      {
        $set: {
          userId: su._id,
          currentTeacherId: teacher._id,
          currentBatchId: batch._id,
        },
      },
      { upsert: true },
    );
    const existingAssignment = await TeacherStudentAssignment.findOne({ teacherId: teacher._id, studentId: su._id, status: "ACTIVE" });
    if (!existingAssignment) {
      await TeacherStudentAssignment.create({ teacherId: teacher._id, studentId: su._id, assignedBy: admin._id, assignedAt: new Date(), status: "ACTIVE" });
    }
    await Batch.updateOne({ _id: batch._id }, { $addToSet: { studentIds: su._id } });
    studentUsers.push({ user: su, teacher, batch });
  }

  const mkQuestion = (data: QuestionSeed) =>
    Question.create({
      createdBy: teacher1._id,
      negativeMarks: 0,
      difficulty: "MEDIUM",
      correctAnswers: [],
      instructions: "",
      passage: "",
      ...data,
    });

  const mkPassage = (data: { title: string; content: string; category: string; tags?: string[] }) =>
    Passage.create({ createdBy: teacher1._id, ...data });

  // ------------------------------------------------------------------
  // IELTS Reading passages
  // ------------------------------------------------------------------
  const readingPassage = await mkPassage({
    title: "Urban Green Spaces",
    category: "IELTS_READING",
    tags: ["environment", "cities"],
    content:
      "Urban green spaces — parks, gardens, and tree-lined streets — play a vital role in the health of cities. They absorb carbon dioxide, release oxygen, and lower surface temperatures through shade. During summer heat waves, neighbourhoods with abundant vegetation can be several degrees cooler than surrounding built-up areas.\n\n" +
      "Despite these benefits, urban green spaces face pressure from development. As cities expand, planners must balance the need for housing with the desire to preserve parks. In many countries, councils have introduced zoning laws that require a minimum amount of green space in new residential developments.\n\n" +
      "Community involvement has also become an important factor. Volunteer gardening groups, school planting projects and neighbourhood allotments have all contributed to the growth of greenery. Research suggests that residents who participate in such schemes report lower levels of stress and a stronger sense of belonging.",
  });

  const renewablePassage = await mkPassage({
    title: "Renewable Energy",
    category: "PTE_READING",
    tags: ["energy", "environment"],
    content:
      "Renewable energy sources such as wind, solar and hydroelectric power produce electricity without releasing carbon dioxide. Although the initial cost of building renewable infrastructure can be high, running costs are low and the fuel is free. As technology improves, renewable energy is becoming cheaper and more reliable, making it an increasingly attractive alternative to fossil fuels for both developed and developing economies.",
  });

  const sleepPassage = await mkPassage({
    title: "Sleep and Memory",
    category: "PTE_LISTENING",
    tags: ["health", "science"],
    content:
      "The lecture discussed the effects of sleep on memory. During deep sleep, the brain transfers information from short-term to long-term memory. Students who sleep well before an exam tend to perform better than those who stay up all night revising. A regular sleep schedule is therefore an essential part of effective study.",
  });

  // ------------------------------------------------------------------
  // IELTS Reading question bank
  // ------------------------------------------------------------------
  const readingQs = [
    await mkQuestion({
      category: "IELTS_READING",
      type: "TRUE_FALSE_NOT_GIVEN",
      title: "Green spaces can reduce temperatures during heat waves.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "TRUE", text: "True" },
        { key: "FALSE", text: "False" },
        { key: "NOT_GIVEN", text: "Not Given" },
      ],
      correctAnswers: ["TRUE"],
      marks: 1,
      difficulty: "EASY",
      explanation: "Paragraph 1 states green spaces 'lower surface temperatures through shade' during heat waves.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "TRUE_FALSE_NOT_GIVEN",
      title: "Every new housing development must include a minimum amount of green space.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "TRUE", text: "True" },
        { key: "FALSE", text: "False" },
        { key: "NOT_GIVEN", text: "Not Given" },
      ],
      correctAnswers: ["NOT_GIVEN"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "The text says 'in many countries' zoning laws require green space, but not that every development everywhere must include it.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "MATCHING_HEADINGS",
      title: "Choose the correct heading for paragraph 1.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "A", text: "Benefits of urban vegetation" },
        { key: "B", text: "Pressure from urban development" },
        { key: "C", text: "Community involvement in green projects" },
        { key: "D", text: "The history of city parks" },
        { key: "E", text: "The cost of maintaining parks" },
      ],
      correctAnswers: ["A"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "Paragraph 1 focuses on the environmental benefits of green spaces.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "MATCHING_HEADINGS",
      title: "Choose the correct heading for paragraph 2.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "A", text: "Benefits of urban vegetation" },
        { key: "B", text: "Pressure from urban development" },
        { key: "C", text: "Community involvement in green projects" },
        { key: "D", text: "The history of city parks" },
        { key: "E", text: "The cost of maintaining parks" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "Paragraph 2 discusses pressure from development and how planners balance housing and parks.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "MATCHING_HEADINGS",
      title: "Choose the correct heading for paragraph 3.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "A", text: "Benefits of urban vegetation" },
        { key: "B", text: "Pressure from urban development" },
        { key: "C", text: "Community involvement in green projects" },
        { key: "D", text: "The history of city parks" },
        { key: "E", text: "The cost of maintaining parks" },
      ],
      correctAnswers: ["C"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "Paragraph 3 describes volunteer groups and community projects.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "SINGLE_CHOICE",
      title: "Which of the following is mentioned as a benefit of urban green spaces?",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "A", text: "They increase road congestion" },
        { key: "B", text: "They lower surface temperatures" },
        { key: "C", text: "They raise property taxes" },
        { key: "D", text: "They create more industrial land" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "EASY",
      explanation: "Paragraph 1 lists lowering surface temperatures among the benefits.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "FILL_BLANK",
      title: "Complete the summary: Volunteer groups, school projects and neighbourhood ______ have contributed to the growth of greenery.",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      options: [
        { key: "A", text: "allotments" },
        { key: "B", text: "factories" },
        { key: "C", text: "highways" },
        { key: "D", text: "shopping malls" },
      ],
      correctAnswers: ["A"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "Paragraph 3 mentions 'neighbourhood allotments'.",
    }),
    await mkQuestion({
      category: "IELTS_READING",
      type: "SHORT_ANSWER",
      title: "What do residents who take part in community schemes report lower levels of? (one word)",
      passageId: readingPassage._id,
      passage: readingPassage.content,
      correctAnswers: ["stress"],
      acceptedAnswers: ["stress", "the stress"],
      marks: 1,
      difficulty: "HARD",
      explanation: "Paragraph 3: residents 'report lower levels of stress'.",
    }),
  ];

  // ------------------------------------------------------------------
  // IELTS Listening question bank
  // ------------------------------------------------------------------
  const listeningQs = [
    await mkQuestion({
      category: "IELTS_LISTENING",
      type: "SINGLE_CHOICE",
      title: "What time does the beginner photography course start?",
      passage:
        "Woman: Good morning, I'd like to book a place on the beginner photography course.\nMan: Certainly. The beginner course runs at ten o'clock, while the intermediate class starts at eleven.",
      options: [
        { key: "A", text: "9 am" },
        { key: "B", text: "10 am" },
        { key: "C", text: "11 am" },
        { key: "D", text: "12 pm" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "EASY",
      explanation: "The man says the beginner course runs at ten o'clock.",
    }),
    await mkQuestion({
      category: "IELTS_LISTENING",
      type: "FILL_BLANK",
      title: "Complete the booking form. Customer surname: Anna ______",
      passage:
        "Man: Could I have your name, please?\nWoman: It's Anna Williams.\nMan: Thank you, Anna. That's all confirmed.",
      options: [
        { key: "A", text: "Wilson" },
        { key: "B", text: "Williams" },
        { key: "C", text: "Williamson" },
        { key: "D", text: "Willis" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "EASY",
      explanation: "The woman's surname is Williams.",
    }),
    await mkQuestion({
      category: "IELTS_LISTENING",
      type: "SINGLE_CHOICE",
      title: "Where is the library located?",
      passage:
        "Man: The library is easy to find. It is located next to the student centre, directly opposite the main entrance of the campus.",
      options: [
        { key: "A", text: "Behind the cafeteria" },
        { key: "B", text: "Next to the student centre" },
        { key: "C", text: "Above the gym" },
        { key: "D", text: "Beside the car park" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "The library is next to the student centre, opposite the main entrance.",
    }),
    await mkQuestion({
      category: "IELTS_LISTENING",
      type: "FILL_BLANK",
      title: "Tourist information booking reference number: three seven nine, two four one, five eight. Enter the full number.",
      passage: "Woman: Could you note the booking reference, please? It is three seven nine, two four one, five eight.",
      options: [
        { key: "A", text: "379 241 58" },
        { key: "B", text: "379 214 58" },
        { key: "C", text: "397 241 58" },
        { key: "D", text: "379 241 85" },
      ],
      correctAnswers: ["A"],
      marks: 1,
      difficulty: "HARD",
      explanation: "The reference is three seven nine, two four one, five eight.",
    }),
  ];

  // ------------------------------------------------------------------
  // IELTS Writing question bank
  // ------------------------------------------------------------------
  const writingQs = [
    await mkQuestion({
      category: "IELTS_WRITING",
      type: "ESSAY",
      title: "Task 2: Technology has made communication between people less meaningful. To what extent do you agree or disagree?",
      instructions:
        "Write at least 250 words. Support your position with relevant examples from your own experience or knowledge.",
      minWordLimit: 250,
      maxWordLimit: 400,
      marks: 9,
      rubric: IELTS_WRITING_RUBRIC,
      tags: ["technology", "communication"],
    }),
    await mkQuestion({
      category: "IELTS_WRITING",
      type: "LETTER",
      title: "Task 1 (General Training): You recently stayed at a hotel and had a problem with your booking. Write a letter to the hotel manager.",
      instructions:
        "In your letter, explain what the problem was, describe how it affected you, and suggest what the manager should do about it. Write at least 150 words.",
      minWordLimit: 150,
      maxWordLimit: 200,
      marks: 9,
      rubric: IELTS_WRITING_RUBRIC,
      tags: ["letter", "complaint"],
    }),
  ];

  // ------------------------------------------------------------------
  // IELTS Speaking question bank
  // ------------------------------------------------------------------
  const speakingQs = [
    await mkQuestion({
      category: "IELTS_SPEAKING",
      type: "SPEAKING_RESPONSE",
      title: "Part 1: Let's talk about your home town.",
      instructions:
        "Record yourself answering the following questions (1-2 minutes total): What is your home town? What do you like most about it? Has it changed much since you were a child?",
      marks: 9,
      rubric: IELTS_SPEAKING_RUBRIC,
      tags: ["part1", "home"],
    }),
    await mkQuestion({
      category: "IELTS_SPEAKING",
      type: "SPEAKING_RESPONSE",
      title: "Part 2 (Cue card): Describe a book you have recently read.",
      instructions:
        "You should say what the book was about, why you chose to read it, and whether you would recommend it to others. Speak for 1-2 minutes.",
      marks: 9,
      rubric: IELTS_SPEAKING_RUBRIC,
      tags: ["part2", "cue card"],
    }),
    await mkQuestion({
      category: "IELTS_SPEAKING",
      type: "SPEAKING_RESPONSE",
      title: "Part 3: Benefits of reading for children.",
      instructions:
        "Answer the following discussion questions: Why is reading important for children's development? Should schools spend more time on reading? Do you think printed books will disappear?",
      marks: 9,
      rubric: IELTS_SPEAKING_RUBRIC,
      tags: ["part3", "discussion"],
    }),
  ];

  // ------------------------------------------------------------------
  // PTE Speaking question bank
  // ------------------------------------------------------------------
  const pteSpeakingQs = [
    await mkQuestion({
      category: "PTE_SPEAKING",
      type: "READ_ALOUD",
      title: "Read the following text aloud in clear, natural English.",
      passage:
        "Climate change is one of the most serious challenges facing the modern world. Governments, businesses and individuals all have a responsibility to reduce carbon emissions and protect the natural environment for future generations.",
      marks: 5,
      rubric: PTE_SPEAKING_RUBRIC,
      tags: ["read aloud", "environment"],
    }),
    await mkQuestion({
      category: "PTE_SPEAKING",
      type: "REPEAT_SENTENCE",
      title: "Repeat the sentence you hear exactly as spoken.",
      passage: "Global temperatures have risen significantly over the past century.",
      marks: 5,
      rubric: PTE_SPEAKING_RUBRIC,
      tags: ["repeat sentence"],
    }),
    await mkQuestion({
      category: "PTE_SPEAKING",
      type: "DESCRIBE_IMAGE",
      title: "Describe the bar chart in detail for 40 seconds.",
      instructions:
        "The chart shows the percentage of students using public transport from 2010 to 2025. The figure rises from 20% in 2010 to 45% in 2020, then stays steady at around 45% until 2025.",
      marks: 5,
      rubric: PTE_SPEAKING_RUBRIC,
      tags: ["describe image", "bar chart"],
    }),
    await mkQuestion({
      category: "PTE_SPEAKING",
      type: "ANSWER_SHORT_QUESTION",
      title: "What is the largest continent in the world?",
      correctAnswers: ["asia"],
      acceptedAnswers: ["asia"],
      marks: 1,
      difficulty: "EASY",
      explanation: "Asia is the largest continent.",
    }),
  ];

  // ------------------------------------------------------------------
  // PTE Writing question bank
  // ------------------------------------------------------------------
  const pteWritingQs = [
    await mkQuestion({
      category: "PTE_WRITING",
      type: "SUMMARIZE_WRITTEN_TEXT",
      title: "Summarize the written text in one sentence of 5-75 words.",
      passageId: renewablePassage._id,
      passage: renewablePassage.content,
      minWordLimit: 5,
      maxWordLimit: 75,
      marks: 5,
      rubric: PTE_WRITING_RUBRIC,
      tags: ["summarize", "energy"],
    }),
    await mkQuestion({
      category: "PTE_WRITING",
      type: "ESSAY",
      title: "Write Essay: Studying abroad offers valuable opportunities. Others argue it is expensive and difficult. Discuss the advantages and disadvantages and give your own opinion.",
      instructions: "Write 200-300 words.",
      minWordLimit: 200,
      maxWordLimit: 300,
      marks: 5,
      rubric: PTE_WRITING_RUBRIC,
      tags: ["essay", "education"],
    }),
  ];

  // ------------------------------------------------------------------
  // PTE Reading question bank
  // ------------------------------------------------------------------
  const pteReadingQs = [
    await mkQuestion({
      category: "PTE_READING",
      type: "MULTIPLE_CHOICE",
      title: "Read the text and select the single best answer. What is the main idea?",
      passageId: renewablePassage._id,
      passage: renewablePassage.content,
      options: [
        { key: "A", text: "Renewable energy is now the only source of power" },
        { key: "B", text: "Renewable energy is becoming cheaper and more reliable" },
        { key: "C", text: "Fossil fuels are better for the environment" },
        { key: "D", text: "Renewable energy produces high levels of carbon dioxide" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "EASY",
      explanation: "The text states renewable energy is becoming cheaper and more reliable.",
    }),
    await mkQuestion({
      category: "PTE_READING",
      type: "MULTIPLE_ANSWER",
      title: "Read the text and select all correct statements (two answers).",
      passage:
        "Honeybees play a crucial role in agriculture by pollinating crops. In recent years, reports of colony collapse disorder have raised concerns among scientists and farmers. Researchers are studying possible causes including pesticides, disease and habitat loss.",
      options: [
        { key: "A", text: "Honeybees help pollinate agricultural crops" },
        { key: "B", text: "Colony collapse disorder has only affected honey production" },
        { key: "C", text: "Researchers are studying possible causes such as pesticides" },
        { key: "D", text: "Scientists have already confirmed the single cause of colony collapse" },
      ],
      correctAnswers: ["A", "C"],
      marks: 2,
      difficulty: "MEDIUM",
      explanation: "A and C are supported by the text; B and D are not.",
    }),
    await mkQuestion({
      category: "PTE_READING",
      type: "FILL_BLANK",
      title: "Reading & Writing: Fill in the blank. 'The new policy aims to reduce energy ______ by 20%.'",
      options: [
        { key: "A", text: "consumption" },
        { key: "B", text: "concentration" },
        { key: "C", text: "construction" },
        { key: "D", text: "conclusion" },
      ],
      correctAnswers: ["A"],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "'Energy consumption' is the correct collocation.",
    }),
  ];

  // ------------------------------------------------------------------
  // PTE Listening question bank
  // ------------------------------------------------------------------
  const pteListeningQs = [
    await mkQuestion({
      category: "PTE_LISTENING",
      type: "SINGLE_CHOICE",
      title: "What time does the museum open?",
      passage: "Welcome to the city museum. The museum is open from ten in the morning until six in the evening. Admission is free for children under twelve.",
      options: [
        { key: "A", text: "9 am" },
        { key: "B", text: "10 am" },
        { key: "C", text: "11 am" },
        { key: "D", text: "6 pm" },
      ],
      correctAnswers: ["B"],
      marks: 1,
      difficulty: "EASY",
      explanation: "The museum opens at ten in the morning.",
    }),
    await mkQuestion({
      category: "PTE_LISTENING",
      type: "FILL_BLANK",
      title: "Fill in the missing word: 'Please complete the registration form and return it to the main ______ before noon.'",
      passage: "Please complete the registration form and return it to the main office before noon.",
      options: [
        { key: "A", text: "office" },
        { key: "B", text: "entrance" },
        { key: "C", text: "desk" },
        { key: "D", text: "hall" },
      ],
      correctAnswers: ["A"],
      marks: 1,
      difficulty: "EASY",
      explanation: "The missing word is 'office'.",
    }),
    await mkQuestion({
      category: "PTE_LISTENING",
      type: "SUMMARIZE_SPOKEN_TEXT",
      title: "Summarize the spoken text in one sentence of 50-70 words.",
      passageId: sleepPassage._id,
      passage: sleepPassage.content,
      minWordLimit: 50,
      maxWordLimit: 70,
      marks: 5,
      rubric: PTE_WRITING_RUBRIC,
      tags: ["summarize", "sleep"],
    }),
    await mkQuestion({
      category: "PTE_LISTENING",
      type: "LISTENING_DICTATION",
      title: "Write the sentence exactly as you hear it.",
      passage: "Please remember to submit your assignment by Friday afternoon.",
      correctAnswers: ["Please remember to submit your assignment by Friday afternoon."],
      acceptedAnswers: [
        "please remember to submit your assignment by friday afternoon",
        "Please remember to submit your assignment by friday afternoon",
      ],
      marks: 1,
      difficulty: "MEDIUM",
      explanation: "Transcribe the full sentence.",
    }),
  ];

  // ------------------------------------------------------------------
  // Sectional practice tests (one per skill)
  // ------------------------------------------------------------------
  const ieltsReadingSectional = await Exam.create({
    createdBy: teacher1._id,
    title: "IELTS Reading Sectional Practice",
    type: "SECTIONAL",
    category: "IELTS_READING",
    description: "True/False/Not Given, matching headings, summary and short-answer questions on urban green spaces.",
    durationSec: 1200,
    questionIds: readingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const ieltsListeningSectional = await Exam.create({
    createdBy: teacher1._id,
    title: "IELTS Listening Sectional Practice",
    type: "SECTIONAL",
    category: "IELTS_LISTENING",
    description: "Multiple choice and form completion practice with transcripts.",
    durationSec: 900,
    questionIds: listeningQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const ieltsWritingSectional = await Exam.create({
    createdBy: teacher1._id,
    title: "IELTS Writing Sectional Practice",
    type: "SECTIONAL",
    category: "IELTS_WRITING",
    description: "Academic Task 2 essay and General Training Task 1 letter. Responses are teacher-graded.",
    durationSec: 2400,
    questionIds: writingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const ieltsSpeakingSectional = await Exam.create({
    createdBy: teacher1._id,
    title: "IELTS Speaking Sectional Practice",
    type: "SECTIONAL",
    category: "IELTS_SPEAKING",
    description: "Part 1, Part 2 cue card and Part 3 discussion prompts. Responses are teacher-graded.",
    durationSec: 600,
    questionIds: speakingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const pteSpeakingSectional = await Exam.create({
    createdBy: teacher2._id,
    title: "PTE Speaking Sectional Practice",
    type: "SECTIONAL",
    category: "PTE_SPEAKING",
    description: "Read Aloud, Repeat Sentence, Describe Image and Answer Short Question practice.",
    durationSec: 900,
    questionIds: pteSpeakingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const pteWritingSectional = await Exam.create({
    createdBy: teacher2._id,
    title: "PTE Writing Sectional Practice",
    type: "SECTIONAL",
    category: "PTE_WRITING",
    description: "Summarize Written Text and Write Essay practice. Responses are teacher-graded.",
    durationSec: 1200,
    questionIds: pteWritingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const pteReadingSectional = await Exam.create({
    createdBy: teacher2._id,
    title: "PTE Reading Sectional Practice",
    type: "SECTIONAL",
    category: "PTE_READING",
    description: "Multiple choice, multi-select and reading & writing fill in the blanks.",
    durationSec: 1500,
    questionIds: pteReadingQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  const pteListeningSectional = await Exam.create({
    createdBy: teacher2._id,
    title: "PTE Listening Sectional Practice",
    type: "SECTIONAL",
    category: "PTE_LISTENING",
    description: "Multiple choice, fill in the blank, summarize spoken text and write from dictation.",
    durationSec: 1500,
    questionIds: pteListeningQs.map((q) => q._id),
    attemptLimit: 3,
    autoSubmit: true,
    allowReview: true,
    status: "PUBLISHED",
  });

  // ------------------------------------------------------------------
  // Full-length mock tests (sections + section-wise timing)
  // ------------------------------------------------------------------
  const ieltsFullMock = await Exam.create({
    createdBy: teacher1._id,
    title: "IELTS Academic Full Mock Test",
    type: "MOCK",
    category: "IELTS_READING",
    description: "Full-length Academic test with Listening, Reading, Writing and Speaking sections in a single timed sitting.",
    durationSec: 9900,
    attemptLimit: 2,
    autoSubmit: true,
    allowLateSubmission: false,
    allowReview: true,
    sectionWiseTiming: true,
    status: "PUBLISHED",
    sections: [
      {
        title: "Listening",
        order: 0,
        durationSec: 1800,
        instructions: "Answer 4 questions. You will hear each recording once.",
        questionIds: listeningQs.map((q) => q._id),
      },
      {
        title: "Reading",
        order: 1,
        durationSec: 3600,
        instructions: "Answer 8 questions based on the passage provided.",
        questionIds: readingQs.map((q) => q._id),
      },
      {
        title: "Writing",
        order: 2,
        durationSec: 3600,
        instructions: "Complete the Task 2 essay and Task 1 letter.",
        questionIds: writingQs.map((q) => q._id),
      },
      {
        title: "Speaking",
        order: 3,
        durationSec: 900,
        instructions: "Answer Part 1, Part 2 and Part 3 questions.",
        questionIds: speakingQs.map((q) => q._id),
      },
    ],
  });

  const pteFullMock = await Exam.create({
    createdBy: teacher2._id,
    title: "PTE Academic Full Mock Test",
    type: "MOCK",
    category: "PTE_READING",
    description: "Full-length PTE Academic mock with Speaking, Writing, Reading and Listening sections.",
    durationSec: 6000,
    attemptLimit: 2,
    autoSubmit: true,
    allowLateSubmission: false,
    allowReview: true,
    sectionWiseTiming: true,
    status: "PUBLISHED",
    sections: [
      {
        title: "Speaking",
        order: 0,
        durationSec: 1800,
        instructions: "Answer all four speaking tasks.",
        questionIds: pteSpeakingQs.map((q) => q._id),
      },
      {
        title: "Writing",
        order: 1,
        durationSec: 1200,
        instructions: "Complete the summarize written text and essay tasks.",
        questionIds: pteWritingQs.map((q) => q._id),
      },
      {
        title: "Reading",
        order: 2,
        durationSec: 1500,
        instructions: "Answer the reading tasks.",
        questionIds: pteReadingQs.map((q) => q._id),
      },
      {
        title: "Listening",
        order: 3,
        durationSec: 1500,
        instructions: "Answer the listening tasks.",
        questionIds: pteListeningQs.map((q) => q._id),
      },
    ],
  });

  const allExams = [
    ieltsReadingSectional,
    ieltsListeningSectional,
    ieltsWritingSectional,
    ieltsSpeakingSectional,
    pteSpeakingSectional,
    pteWritingSectional,
    pteReadingSectional,
    pteListeningSectional,
    ieltsFullMock,
    pteFullMock,
  ];

  // ------------------------------------------------------------------
  // Writing assignment (teacher-assessed)
  // ------------------------------------------------------------------
  const assignment = await Assignment.create({
    createdBy: teacher1._id,
    title: "IELTS Writing Task 2 Essay",
    description: "Write a 250-400 word essay.",
    instructions: "Word count requirement: 250-400 words. Focus on coherence and cohesion.",
    questionIds: [writingQs[0]._id],
    dueAt: new Date(Date.now() + 14 * 86400000),
    maxMarks: 9,
    status: "ASSIGNED",
  });

  // ------------------------------------------------------------------
  // Assign everything + seed attempts/results
  // ------------------------------------------------------------------
  for (const su of studentUsers) {
    const { user, teacher: t } = su;

    for (const exam of allExams) {
      await ExamAssignment.create({
        examId: exam._id,
        studentId: user._id,
        teacherId: t._id,
        assignedBy: t._id,
        assignedAt: new Date(),
        status: "ASSIGNED",
      });
    }

    await Assignment.updateOne({ _id: assignment._id }, { $addToSet: { studentIds: user._id } });

    const attempt = await ExamAttempt.create({
      examId: ieltsReadingSectional._id,
      studentId: user._id,
      teacherId: t._id,
      attemptNumber: 1,
      startedAt: new Date(Date.now() - 3600000),
      expiresAt: new Date(Date.now() - 60000),
      submittedAt: new Date(),
      status: "GRADED",
      objectiveScore: 0.75,
      rawScore: 0.75,
      maxScore: 1,
      finalScore: 0.75,
      practiceBand: 6.5,
    });
    await ExamAnswer.create({
      attemptId: attempt._id,
      examId: ieltsReadingSectional._id,
      studentId: user._id,
      questionId: readingQs[0]._id,
      answer: "TRUE",
      answered: true,
      isObjective: true,
      autoCorrect: { isCorrect: true, earnedScore: 0.75 },
    });
    await Result.create({
      attemptId: attempt._id,
      examId: ieltsReadingSectional._id,
      studentId: user._id,
      teacherId: t._id,
      examTitle: ieltsReadingSectional.title,
      category: "IELTS_READING",
      finalScore: 0.75,
      rawScore: 0.75,
      maxScore: 1,
      percentage: 75,
      practiceBand: 6.5,
      published: true,
      publishedAt: new Date(),
    });
    await Grade.create({
      attemptId: attempt._id,
      graderId: t._id,
      studentId: user._id,
      teacherId: t._id,
      score: 0.75,
      status: "PUBLISHED",
      feedback: "Good work. Review techniques for True/False/Not Given.",
    });

    const fullAttempt = await ExamAttempt.create({
      examId: ieltsFullMock._id,
      studentId: user._id,
      teacherId: t._id,
      attemptNumber: 1,
      startedAt: new Date(Date.now() - 7200000),
      expiresAt: new Date(Date.now() - 1800000),
      submittedAt: new Date(Date.now() - 3600000),
      status: "GRADED",
      objectiveScore: 6,
      rawScore: 6,
      maxScore: 8,
      finalScore: 6,
      practiceBand: 7.0,
    });
    await Result.create({
      attemptId: fullAttempt._id,
      examId: ieltsFullMock._id,
      studentId: user._id,
      teacherId: t._id,
      examTitle: ieltsFullMock.title,
      category: "IELTS_READING",
      finalScore: 6,
      rawScore: 6,
      maxScore: 8,
      percentage: 75,
      practiceBand: 7.0,
      published: true,
      publishedAt: new Date(),
    });

    await AssignmentSubmission.create({
      assignmentId: assignment._id,
      studentId: user._id,
      teacherId: t._id,
      content: "Modern technology has transformed education in meaningful ways.",
      submittedAt: new Date(),
      isDraft: false,
      status: "SUBMITTED",
    });
  }

  console.log("[seed] done");
  await mongoose.disconnect();
}

interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: "SUPER_ADMIN" | "TEACHER" | "STUDENT";
  createdBy?: unknown;
}

async function ensureUser(data: SeedUser) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create(data);
}

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});

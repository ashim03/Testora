/**
 * Synthetic IELTS/PTE calibration dataset.
 *
 * Samples are generated from band-descriptor-guided templates so that the
 * expert label is determined by construction: vocabulary tier, cohesion,
 * grammar accuracy, task-response completeness, and (for speaking) filler
 * and sentence-complexity profiles are all controlled by the band parameter.
 * Deterministic seeded RNG keeps the dataset reproducible.
 *
 * Golden hand-written samples live in ./ieltsDataset.ts and are kept as the
 * primary gate; this synthetic set scales calibration coverage to 200+.
 */

import { pteFromIelts as bandScalesPteFromIelts } from "../../utils/bandScales";

export type WritingVariant = "TASK2_ESSAY" | "GT_LETTER" | "ACADEMIC_TASK1" | "PTE_SUMMARIZE";

export interface SyntheticWritingSample {
  name: string;
  variant: WritingVariant;
  prompt: string;
  essay: string;
  expectedIelts: number;
  expectedPte?: number;
}

export interface SyntheticSpeakingSample {
  name: string;
  variant: "IELTS_PART2" | "PTE_RETELL" | "PTE_DESCRIBE_IMAGE";
  prompt: string;
  transcript: string;
  durationSec: number;
  expectedIelts: number;
  expectedPte?: number;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: number) {
  const rng = mulberry32(seed);
  return {
    rng,
    pick: <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)],
    chance: (p: number): boolean => rng() < p,
    int: (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1)),
  };
}

type Tier = "high" | "mid" | "low";
const tierOf = (band: number): Tier => (band >= 7.5 ? "high" : band >= 6 ? "mid" : "low");
const pteFromIelts = bandScalesPteFromIelts;

// ---------------------------------------------------------------------------
// Writing: Task 2 essays
// ---------------------------------------------------------------------------

interface Task2Topic {
  subject: string;
  claim: string;
  counter: string;
  example: string;
  reason: string;
  position: string;
}

const TASK2_TOPICS: Task2Topic[] = [
  {
    subject: "the rapid spread of digital technology",
    claim: "it has made everyday life considerably more convenient",
    counter: "it has weakened genuine face-to-face relationships",
    example: "mobile banking and instant messaging have removed hours of waiting from ordinary routines",
    reason: "households can now complete tasks in minutes that once required a whole morning",
    position: "largely agree",
  },
  {
    subject: "the question of when children should begin formal schooling",
    claim: "an early start gives children an academic advantage",
    counter: "starting too young can create stress and reduce time for play",
    example: "children who begin reading at four often outperform their peers in early primary tests",
    reason: "the early years are a critical window for language acquisition",
    position: "partly agree",
  },
  {
    subject: "the growth of remote work",
    claim: "working from home improves productivity and wellbeing",
    counter: "it isolates employees and blurs the line between work and rest",
    example: "commuters who work remotely save two hours a day that they can spend with their families",
    reason: "focused home environments often produce deeper concentration than open-plan offices",
    position: "agree to a large extent",
  },
  {
    subject: "public spending on railways versus roads",
    claim: "rail investment is a better long-term use of public money",
    counter: "roads serve rural communities and goods transport more flexibly",
    example: "high-speed rail links have cut journey times between major cities in half",
    reason: "rail is significantly less polluting per passenger kilometre than road travel",
    position: "agree",
  },
  {
    subject: "the cost of university education",
    claim: "higher education should be funded by the state",
    counter: "free tuition places a heavy burden on taxpayers",
    example: "countries with free tuition report higher graduate employment rates",
    reason: "an educated population benefits the whole economy, not only the graduates",
    position: "agree",
  },
  {
    subject: "advertising aimed at children",
    claim: "such advertising should be banned",
    counter: "advertising teaches children to make consumer decisions",
    example: "food adverts aimed at children are dominated by sugary cereals and snacks",
    reason: "young children cannot yet judge the persuasive intent of advertising",
    position: "agree",
  },
  {
    subject: "international tourism",
    claim: "international tourism brings more benefits than drawbacks to local communities",
    counter: "tourism damages local communities more than it helps them",
    example: "tourism revenue funds the upkeep of historic buildings and sustains local guesthouses and craft workshops",
    reason: "visitor spending creates year-round jobs for families that would otherwise depend on unstable seasonal work",
    position: "agree",
  },
  {
    subject: "reducing meat consumption",
    claim: "eating less meat is necessary to protect the environment",
    counter: "meat is a valuable source of nutrition and central to many cultures",
    example: "livestock farming accounts for a substantial share of greenhouse gas emissions",
    reason: "shifting diets is one of the fastest ways individuals can reduce their footprint",
    position: "agree",
  },
];

const ESSAY_INTRO: Record<Tier, (t: Task2Topic) => string> = {
  high: (t) =>
    `It is widely acknowledged that ${t.subject} is reshaping everyday life, and opinion is divided over whether ${t.claim}. In this essay, I will argue that I ${t.position} with this view, while acknowledging the strongest objections.`,
  mid: (t) =>
    `Nowadays, ${t.subject} is a very common topic of discussion. Some people believe that ${t.claim}, but others disagree. In my opinion, I ${t.position}, and there are several important reasons for this. Many countries have already felt the effects of this change.`,
  low: (t) =>
    `Today, ${t.subject} is important for many peoples. I think ${t.claim}. There are many reason for this, and I will write about them below.`,
};

const ESSAY_BODY_CLAIM: Record<Tier, (t: Task2Topic) => string> = {
  high: (t) =>
    `The principal argument in favour of this position is that ${t.claim}. For instance, ${t.example}, which has made daily routines markedly more efficient. Moreover, ${t.reason}, and the cumulative effect on quality of life should not be underestimated. It is worth emphasising that these gains are not confined to wealthy countries, since similar patterns have been observed in developing economies as well.`,
  mid: (t) =>
    `First of all, ${t.claim}. For example, ${t.example}. In addition, ${t.reason}, so this has a real impact on people's daily lives. Besides, these changes are visible in almost every household, which makes the trend hard to ignore.`,
  low: (t) =>
    `The first reason is that ${t.claim}. For example, ${t.example}. Also, ${t.reason}, so it is very important for the life of people. Many people see this with their own eyes every day, and it is hard to deny this situation. In my country, the situation is the same, and many people agree with me.`,
};

const ESSAY_BODY_COUNTER: Record<Tier, (t: Task2Topic) => string> = {
  high: (t) =>
    `Nevertheless, opponents contend that ${t.counter}. There is some merit in this concern, as this objection reflects a genuine phenomenon in many everyday contexts. However, such drawbacks are typically outweighed by the practical advantages described above, and they can be addressed through sensible policy rather than wholesale rejection. What is more, many of these concerns can be mitigated through thoughtful regulation and public awareness campaigns.`,
  mid: (t) =>
    `On the other hand, some people say that ${t.counter}. This can be true in some situations, and both sides have some support in everyday experience. However, I believe the advantages are bigger than the disadvantages. Still, the trend has more supporters than opponents, and it is likely to continue.`,
  low: (t) =>
    `But other people think that ${t.counter}. Maybe they are right sometimes, but I still believe that ${t.claim}. The good things are more important than the bad things, and I am not change my mind about this.`,
};

const ESSAY_CONCLUSION: Record<Tier, (t: Task2Topic) => string> = {
  high: (t) =>
    `In conclusion, although the objections are not without foundation, the evidence strongly suggests that ${t.claim}. The benefits, when weighed carefully, clearly justify the continuation of this trend, provided it is guided by sensible regulation. The trajectory is likely to continue, but its direction will depend on how thoughtfully society chooses to manage it.`,
  mid: (t) =>
    `To conclude, I believe that ${t.claim}. The positives outweigh the negatives, and governments and individuals should support the trend with sensible policies. In the end, sensible policies and individual choices together will decide how the trend develops.`,
  low: (t) =>
    `In conclusion, I think ${t.claim}. Many countries are already moving in this direction, and I hope the trend continues in the future. It is important for the life of people in many places around the world.`,
};

const GRAMMAR_ERRORS = [
  ["there is many", "there are many"],
  ["are many reason", "are many reasons"],
  ["good for peoples", "good for people"],
  ["peoples", "people"],
  ["informations", "information"],
  ["childrens", "children"],
  ["more better", "better"],
  ["advices", "advice"],
  ["in last year", "last year"],
  ["is more big", "is bigger"],
  ["many researches", "much research"],
  ["it depend on", "it depends on"],
  ["should continues", "should continue"],
  ["do not change", "do not change"],
  ["I has", "I have"],
  ["i am", "I am"],
  ["i write", "I write"],
  ["is is", "is"],
  ["and and", "and"],
  ["the the", "the"],
  ["to to", "to"],
];

/** Deterministically injects a requested number of common low-band errors. */
function injectErrors(text: string, count: number, rng: () => number): string {
  let result = text;
  const applied = new Set<number>();
  let attempts = 0;
  while (applied.size < count && attempts < 40) {
    attempts += 1;
    const idx = Math.floor(rng() * GRAMMAR_ERRORS.length);
    if (applied.has(idx)) continue;
    const [wrong, right] = GRAMMAR_ERRORS[idx];
    const re = new RegExp(`\\b${right}\\b`);
    if (re.test(result)) {
      result = result.replace(re, wrong);
      applied.add(idx);
    }
  }
  return result;
}

const HIGH_INTRO_FRAMES = [
  (t: Task2Topic) => `It is widely acknowledged that ${t.subject} is reshaping everyday life, and opinion is divided over whether ${t.claim}. In this essay, I will argue that I broadly agree with this view, while acknowledging the strongest objections.`,
  (t: Task2Topic) => `Few topics generate as much debate as ${t.subject}, and the question of whether ${t.claim} divides both experts and the public. This essay will set out why I largely share this position.`,
  (t: Task2Topic) => `There is growing discussion about ${t.subject}, with some commentators claiming that ${t.claim}. After weighing both sides, I have come down in favour of this view, and the reasons are set out below.`,
  (t: Task2Topic) => `In recent years, ${t.subject} has moved to the centre of public debate, and the claim that ${t.claim} deserves careful examination. On balance, I agree with this position, for the reasons that follow.`,
];

const HIGH_CLAIM_OPENERS = [
  "The principal argument in favour of this position is that",
  "The most compelling reason for supporting this view is that",
  "A strong case for this position rests on the fact that",
  "The decisive consideration in its favour is that",
];

const HIGH_CLAIM_TAILS = [
  "which has made daily routines markedly more efficient",
  "a point that is borne out by everyday experience",
  "and the cumulative effect on quality of life should not be underestimated",
  "an outcome that is visible in virtually every community",
];

const HIGH_COUNTER_OPENERS = [
  "Nevertheless, opponents contend that",
  "That said, critics point out that",
  "Opponents of this view argue that",
  "It must be conceded, however, that",
];

const HIGH_CONCLUSION_OPENERS = [
  "In conclusion, although the objections are not without foundation",
  "To sum up, the evidence strongly suggests that",
  "All things considered, the case for this position remains persuasive, and",
];

function buildTask2Essay(rng: ReturnType<typeof makeRng>, band: number, topic: Task2Topic): string {
  const tier = tierOf(band);
  const essay = tier === "high"
    ? [
        rng.pick(HIGH_INTRO_FRAMES)(topic),
        `${rng.pick(HIGH_CLAIM_OPENERS)} ${topic.claim}. For instance, ${topic.example}, ${rng.pick(HIGH_CLAIM_TAILS)}. Moreover, ${topic.reason}. It is worth emphasising that these gains are not confined to wealthy countries, since similar patterns have been observed in developing economies as well.`,
        `${rng.pick(HIGH_COUNTER_OPENERS)} ${topic.counter}. There is some merit in this concern, as this objection reflects a genuine phenomenon in many everyday contexts. However, such drawbacks are typically outweighed by the practical advantages described above, and they can be addressed through sensible policy rather than wholesale rejection. What is more, many of these concerns can be mitigated through thoughtful regulation and public awareness campaigns.`,
        `${rng.pick(HIGH_CONCLUSION_OPENERS)} ${topic.claim}. The benefits, when weighed carefully, clearly justify the continuation of this trend, provided it is guided by sensible regulation. The trajectory is likely to continue, but its direction will depend on how thoughtfully society chooses to manage it.`,
      ].join("\n")
    : [
        ESSAY_INTRO[tier](topic),
        ESSAY_BODY_CLAIM[tier](topic),
        ESSAY_BODY_COUNTER[tier](topic),
        ESSAY_CONCLUSION[tier](topic),
      ].join("\n");
  const errorCount = tier === "low" ? rng.int(3, 5) : tier === "mid" ? rng.chance(0.5) ? 1 : 0 : 0;
  return errorCount > 0 ? injectErrors(essay, errorCount, rng.rng) : essay;
}

// ---------------------------------------------------------------------------
// Writing: General Training letters
// ---------------------------------------------------------------------------

interface LetterScenario {
  purpose: string;
  bodyPurpose: string;
  formality: "formal" | "informal";
  salutation: string;
  signoff: string;
  bullets: string[];
  details: string[];
}

const LETTER_SCENARIOS: LetterScenario[] = [
  {
    purpose: "complain about a faulty laptop purchased from an online store",
    bodyPurpose: "complain about a faulty laptop I bought from an online store",
    formality: "formal",
    salutation: "Dear Sir or Madam,",
    signoff: "Yours faithfully,",
bullets: ["describe the fault in detail", "explain what I have done to fix it", "state what I expect the store to do"],
    details: [
      "the screen flickers constantly whenever the laptop is running, and the battery now drains within thirty minutes of a full charge, so the machine is almost impossible to use for work",
      "I have already restarted the laptop, updated the drivers, and run the diagnostics tool, but none of these steps has had any effect on the faults",
      "I expect the store to replace the laptop or refund the full purchase price, whichever you consider appropriate, since the machine is still within its warranty period",
      "Please let me know how you would like to proceed, and whether you need the receipt or the original packaging to arrange the return",
    ],
  },
  {
    purpose: "request two weeks of unpaid leave from your employer",
    bodyPurpose: "request two weeks of unpaid leave",
    formality: "formal",
    salutation: "Dear Mr Harris,",
    signoff: "Yours sincerely,",
    bullets: ["state when I need the leave", "explain the reason for the request", "say how my work will be covered"],
    details: [
      "I would need to be away from work from the second until the sixteenth of May, which is just under two weeks in total",
      "my father is undergoing surgery during that period, and I will need to help the family while he recovers at home",
      "I have arranged for a colleague to cover my main responsibilities, and I will prepare detailed handover notes before I leave",
      "I am happy to discuss the arrangements further, and I will submit the formal request as soon as you approve",
    ],
  },
  {
    purpose: "thank a friend who hosted you for the weekend",
    bodyPurpose: "thank you for the wonderful weekend I spent with you",
    formality: "informal",
    salutation: "Dear Emma,",
    signoff: "Best wishes,",
    bullets: ["thank your friend for the weekend", "mention something you particularly enjoyed", "invite them to visit you soon"],
    details: [
      "the meals you cooked were wonderful, and the pasta dinner on Saturday was easily the best part of the whole trip, which I will remember for a long time",
      "I particularly loved our long walk by the lake on Sunday morning, when the town was completely quiet and the weather was perfect for a leisurely stroll",
      "you must come and stay with me next month, so that I can finally return the favour and show you around my city, which has changed a lot since your last visit",
      "I have already started planning the visit, and I cannot wait to repay your hospitality in the same generous spirit that you showed me",
    ],
  },
  {
    purpose: "give advice to your cousin about choosing a university course",
    bodyPurpose: "give you some advice about choosing a university course",
    formality: "informal",
    salutation: "Dear Tom,",
    signoff: "Lots of love,",
    bullets: ["ask how the search is going", "give your opinion on the two options", "offer to help with the application"],
    details: [
      "I hear you are still weighing the engineering and economics programmes, so I wanted to share my thoughts while the choice is still open",
      "in my view engineering suits you better, because you have always enjoyed practical problem solving and building things with your hands",
      "I can send you the university prospectus and help you draft the application letter, which is often the part people find hardest",
      "let me know when you have made your decision, and I will do everything I can to support you either way",
    ],
  },
  {
    purpose: "apologise to your neighbour about noise from a party",
    bodyPurpose: "apologise for the noise from my party",
    formality: "informal",
    salutation: "Dear Mr and Mrs Patel,",
    signoff: "Kind regards,",
    bullets: ["apologise for the noise", "explain what happened", "promise it will not happen again"],
    details: [
      "I am sorry that the music from my birthday party kept you awake on Saturday night, and I apologise sincerely for the disturbance",
      "some friends stayed much later than I expected, and I simply did not notice how loud the music had become as the evening went on",
      "I will keep the volume low and end any future gatherings before ten o'clock, so this will not happen again",
      "if the noise caused any damage or disturbance beyond the music itself, please tell me and I will put it right",
    ],
  },
  {
    purpose: "apply for a volunteer position at a community library",
    bodyPurpose: "apply for the volunteer position at the community library",
    formality: "formal",
    salutation: "Dear Coordinator,",
    signoff: "Yours faithfully,",
    bullets: ["state the position you are applying for", "describe your relevant experience", "explain why you want to volunteer"],
    details: [
      "I am writing to apply for the position of Saturday morning reading group helper, which I saw advertised on the library noticeboard",
      "I spent two years helping at my school library, where I organised the shelves and assisted younger students with choosing books",
      "I want to volunteer because I enjoy working with children and I believe that reading opens doors that nothing else can",
      "I am available on Saturdays and can also help with weekday shelving if the library ever needs an extra pair of hands",
    ],
  },
];

const LETTER_OPENERS: Record<Tier, string> = {
  high: "I am writing to",
  mid: "I am writing this letter to",
  low: "I write this letter to",
};

const LETTER_CLOSERS: Record<Tier, string> = {
  high: "Thank you for your time and consideration, and I look forward to hearing from you soon.",
  mid: "Please let me know as soon as possible. Thank you for your time.",
  low: "Please reply to me soon. Thank you very much.",
};

function buildLetter(rng: ReturnType<typeof makeRng>, band: number, scenario: LetterScenario): string {
  const tier = tierOf(band);
  const lines: string[] = [scenario.salutation];
  lines.push(`${LETTER_OPENERS[tier]} ${scenario.bodyPurpose}.`);
  const [d0, d1, d2, d3] = scenario.details;
  if (tier === "high") {
    lines.push(`To begin with, ${d0}.`);
    lines.push(`In addition, I should mention that ${d1}.`);
    lines.push(`Furthermore, ${d2}.`);
    lines.push(`Finally, ${d3}.`);
  } else if (tier === "mid") {
    lines.push(`First, ${d0}.`);
    lines.push(`Second, ${d1}.`);
    lines.push(`Also, ${d2}.`);
    lines.push(`Finally, ${d3}.`);
  } else {
    lines.push(`${cap(d0)}. I have many reason for writing this letter.`);
    lines.push(`${cap(d1)}.`);
    lines.push(`${cap(d2)}. Please help me with this, I hope you can understand.`);
  }
  lines.push(LETTER_CLOSERS[tier]);
  lines.push(scenario.signoff);
  lines.push(scenario.formality === "formal" ? "Maria Silva" : "Maria");
  let letter = lines.join("\n");
  const errorCount = tier === "low" ? rng.int(8, 10) : tier === "mid" ? rng.int(2, 3) : 0;
  if (errorCount > 0) letter = injectErrors(letter, errorCount, rng.rng);
  return letter;
}

// ---------------------------------------------------------------------------
// Writing: Academic Task 1 (charts, maps, processes)
// ---------------------------------------------------------------------------

interface ChartData {
  title: string;
  overview: string;
  features: string[];
  units: string;
}

const CHART_DATA: ChartData[] = [
  {
    title: "the number of tourists visiting four European capitals between 2000 and 2020",
    overview: "all four cities recorded steady growth in visitor numbers, with Paris remaining the most popular throughout the period",
    features: [
      "Paris rose from around 12 million visitors in 2000 to nearly 20 million by 2020",
      "Madrid overtook Rome in 2015 and finished the period as the second most visited city",
      "the smallest growth was seen in Berlin, which increased by only two million over twenty years",
    ],
    units: "million visitors",
  },
  {
    title: "the percentage of household income spent on food, housing and transport in five countries",
    overview: "housing was the largest expense in every country, while food accounted for the smallest share",
    features: [
      "housing absorbed between 35 and 42 per cent of income in all five countries",
      "transport ranged from 12 per cent in France to 21 per cent in the United States",
      "the food share was inversely related to income, falling below 10 per cent in the wealthiest country",
    ],
    units: "per cent",
  },
  {
    title: "average daily electricity production from four sources over a year",
    overview: "solar output peaked sharply in summer, whereas wind generation was highest during the winter months",
    features: [
      "solar production rose from almost nothing in January to a peak of 4.5 gigawatts in July",
      "wind output remained above 2 gigawatts all year, peaking at 3.8 gigawatts in December",
      "coal and gas filled the gaps, dropping below 1 gigawatt only during the sunniest weeks",
    ],
    units: "gigawatts",
  },
  {
    title: "the proportion of adults who exercise regularly, by age group, in 2005 and 2025",
    overview: "regular exercise increased across every age group, with the largest gains among adults over sixty",
    features: [
      "the 20-29 age group exercised most in both years, at 68 per cent in 2025",
      "participation among the over-60s more than doubled from 18 per cent to 41 per cent",
      "the 40-49 group showed the smallest change, rising by just four percentage points",
    ],
    units: "per cent",
  },
  {
    title: "a town centre before and after a pedestrianisation project",
    overview: "the main shopping street was closed to cars and a new park and cycle lane were created in its place",
    features: [
      "the former car park beside the station became a public park with a playground",
      "a dedicated cycle lane now connects the station to the market square",
      "a new bus stop was built on the ring road to serve residents of the surrounding estates",
    ],
    units: "map",
  },
  {
    title: "how recycled glass is processed into new bottles",
    overview: "the process involves seven main stages, beginning with collection and ending with the delivery of new bottles to retailers",
    features: [
      "glass is first sorted by colour and crushed into fine pieces called cullet",
      "the cullet is melted at very high temperatures and mixed with fresh raw materials",
      "the molten glass is blown into moulds and cooled before being checked for defects",
    ],
    units: "process",
  },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildTask1(rng: ReturnType<typeof makeRng>, band: number, chart: ChartData): string {
  const tier = tierOf(band);
  const parts: string[] = [];
  if (tier === "high") {
    parts.push(`The charts illustrate ${chart.title}.`);
    parts.push(`Overall, ${chart.overview}.`);
    parts.push(cap(chart.features[0]) + ".");
    parts.push(cap(chart.features[1]) + ". Meanwhile, " + chart.features[2] + ".");
    parts.push("In relative terms, the fastest-growing item recorded a rise of roughly one third over the period, whereas the slowest grew by less than ten per cent.");
    parts.push("Taken together, these figures point to a clear and consistent pattern across the whole period.");
  } else if (tier === "mid") {
    parts.push(`The charts show ${chart.title}.`);
    parts.push(`In general, ${chart.overview}.`);
    parts.push(cap(chart.features[0]) + ".");
    parts.push(cap(chart.features[1]) + ". " + chart.features[2] + ".");
    parts.push("The differences between the items narrowed slightly over time, but the overall ranking stayed the same.");
  } else {
    parts.push(`This charts show about ${chart.title}.`);
    parts.push(cap(chart.features[0]) + ".");
    parts.push(cap(chart.features[1]) + ". " + chart.features[2] + ".");
    parts.push("In my opinion the numbers are interesting, and it is good for peoples. The government should do something about it."); // opinion → penalised task response
  }
  let text = parts.join("\n");
  const errorCount = tier === "low" ? rng.int(3, 5) : tier === "mid" ? rng.chance(0.5) ? 1 : 0 : 0;
  if (errorCount > 0) text = injectErrors(text, errorCount, rng.rng);
  return text;
}

// ---------------------------------------------------------------------------
// Writing: PTE Summarize Written Text
// ---------------------------------------------------------------------------

interface Passage {
  title: string;
  subject: string;
  passage: string;
  keyPoints: string[];
}

const PASSAGES: Passage[] = [
  {
    title: "mangrove ecosystems",
    subject: "Mangrove forests",
    passage:
      "Mangrove forests grow along tropical coastlines and protect the shore from storms and erosion. Their roots provide a nursery habitat for fish and birds, which supports local fishing communities. Because mangroves absorb carbon at a high rate, their conservation also matters for climate change.",
    keyPoints: [
      "protect coastlines from storms and erosion",
      "provide a nursery habitat for fish and birds, supporting local fishing communities",
      "absorb carbon at a high rate, making their conservation relevant to climate change",
    ],
  },
  {
    title: "the invention of the postage stamp",
    subject: "The Penny Black",
    passage:
      "Before the postage stamp, letters were paid for by the receiver and the cost depended on distance. In 1840 Britain introduced the Penny Black, a stamp paid in advance at a flat rate. Postal volumes grew rapidly, and other countries soon adopted the same system, transforming communication for ordinary people.",
    keyPoints: [
      "meant that the receiver no longer paid and that cost did not depend on distance",
      "introduced prepaid postage at a flat rate in 1840",
      "spread worldwide and transformed communication for ordinary people",
    ],
  },
  {
    title: "urban green spaces",
    subject: "Urban green spaces",
    passage:
      "Research shows that parks and green spaces in cities lower stress and encourage physical activity. They also cool the surrounding area during heatwaves, which is increasingly important as urban temperatures rise. Planners therefore argue that green infrastructure should be a standard part of new housing developments.",
    keyPoints: [
      "lower stress and encourage physical activity",
      "cool surrounding areas during heatwaves, which matters as urban temperatures rise",
      "should become a standard part of new housing developments, planners argue",
    ],
  },
  {
    title: "sleep and memory",
    subject: "Sleep",
    passage:
      "During sleep, the brain replays and consolidates the experiences of the day, moving memories into long-term storage. Studies find that people who sleep after learning perform better on tests than those who stay awake. For students, regular sleep is therefore not a luxury but a central part of effective studying.",
    keyPoints: [
      "helps the brain replay and consolidate the experiences of the day",
      "improves test performance when it follows learning",
      "is a central part of effective studying for students, not a luxury",
    ],
  },
];

function buildSummarize(rng: ReturnType<typeof makeRng>, band: number, passage: Passage): string {
  const tier = tierOf(band);
  const coverage = tier === "high" ? 3 : tier === "mid" ? 2 : 1;
  const points = passage.keyPoints.slice(0, coverage);
  let summary: string;
  if (coverage === 3) {
    summary = `${passage.subject} ${points[0]}, ${points[1]}, and ${points[2]}.`;
  } else if (coverage === 2) {
    summary = `${passage.subject} ${points[0]} and ${points[1]}.`;
  } else {
    summary = `${passage.subject} ${points[0]}, which is a problem in many countries today.`; // invented idea
    if (rng.chance(0.5)) {
      summary = `${summary} It is important to know this.`; // second sentence → form penalty
    }
  }
  if (tier !== "high" && rng.chance(0.5)) {
    summary = injectErrors(summary, 1, rng.rng);
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Speaking: IELTS Part 2 monologues
// ---------------------------------------------------------------------------

interface SpeakingPrompt {
  prompt: string;
  opener: string;
  subject: string;
  points: string[];
  closer: string;
}

const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  {
    prompt: "Describe a place you like to visit. You should say where it is, when you go there, and why you enjoy it.",
    opener: "The place I enjoy visiting most is",
    subject: "the old library near the river",
    points: ["it is close to the river and very quiet", "I usually go on Sunday mornings when it is not crowded", "I can read, think, and work without interruptions"],
    closer: "for me, that place is where I can relax and focus at the same time, and I always leave feeling refreshed",
  },
  {
    prompt: "Describe a time you helped someone. What happened and how did you feel?",
    opener: "One occasion when I helped someone was",
    subject: "helping my friend move to a new flat",
    points: ["there was no lift and many heavy boxes", "we carried everything together and finished by the evening", "we finished before dark and celebrated with a takeaway dinner"],
    closer: "I felt tired but happy, because seeing my friend relieved made the whole day worthwhile",
  },
  {
    prompt: "Describe a skill you would like to learn. You should say what it is, how you would learn it, and why it interests you.",
    opener: "A skill I would really like to learn is",
    subject: "playing the guitar",
    points: ["it is something I have always admired", "I would take weekly lessons and practise at home", "it would let me play music for friends and family"],
    closer: "I think learning an instrument would be a rewarding hobby that stays with me for life",
  },
  {
    prompt: "Describe a book that influenced you. You should say what it was, what it was about, and why it mattered to you.",
    opener: "The book that influenced me most was",
    subject: "a novel about a long journey across the mountains",
    points: ["it was recommended by a teacher I admired", "the main character kept going despite every setback", "it taught me that persistence matters more than talent"],
    closer: "since reading it, I have tried to approach difficult tasks with the same calm patience",
  },
  {
    prompt: "Describe a successful small business you know. You should say what it does, how it started, and why it is successful.",
    opener: "A small business that I know quite well is",
    subject: "a bakery that opened near my school",
    points: ["it was started by a neighbour with one oven and a family recipe", "the owner bakes every morning before the shop opens", "people queue for the bread because it is always fresh and fairly priced"],
    closer: "the bakery shows me that consistent quality and friendly service are the real keys to success",
  },
];

const FILLERS: Record<Tier, string[]> = {
  low: ["um", "uh", "like", "you know", "yeah"],
  mid: ["um", "like", "you know"],
  high: [],
};

function buildPart2(rng: ReturnType<typeof makeRng>, band: number, prompt: SpeakingPrompt): string {
  const tier = tierOf(band);
  const fillerCount = tier === "low" ? rng.int(9, 14) : tier === "mid" ? rng.int(2, 4) : rng.int(0, 1);
  const sentences: string[] = [];
  const [p0, p1, p2] = prompt.points;
  if (tier === "high") {
    sentences.push(`${prompt.opener} ${prompt.subject}, and this is something I have often thought about.`);
    sentences.push(`${cap(p0)}, and this is exactly the aspect that stands out to me.`);
    sentences.push(`${cap(p1)}, and it made the experience genuinely memorable.`);
    sentences.push(`${cap(p2)}, which is what I remember most clearly about it.`);
    sentences.push(`Ultimately, ${prompt.closer}.`);
  } else if (tier === "mid") {
    sentences.push(`${prompt.opener} ${prompt.subject}, and I have good reasons for saying this.`);
    sentences.push(`${cap(p0)}. That is one of the main reasons.`);
    sentences.push(`${cap(p1)}, and I remember it very well.`);
    sentences.push(`${cap(p2)}, which made the whole thing worthwhile.`);
    sentences.push(`Overall, ${prompt.closer}.`);
  } else {
    sentences.push(`${prompt.opener} ${prompt.subject}.`);
    sentences.push(`${cap(p0)}. I like this very much.`);
    sentences.push(`${cap(p1)}. This is true, I think.`);
    sentences.push(`${cap(p2)}. I can say this from my own experience.`);
    sentences.push(`So, ${prompt.closer}.`);
  }
  // Interleave fillers into the transcript (avoid repeating the same filler consecutively).
  const fillers = FILLERS[tier];
  let text = sentences.join(" ");
  let lastFiller: string | null = null;
  for (let i = 0; i < fillerCount; i++) {
    let filler = rng.pick(fillers);
    if (fillers.length > 1) {
      while (filler === lastFiller) filler = rng.pick(fillers);
    }
    lastFiller = filler;
    const pos = rng.int(1, 3);
    const words = text.split(" ");
    if (words.length > pos + 1) {
      words.splice(Math.min(pos + i * 3, words.length - 1), 0, filler);
      text = words.join(" ");
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// Speaking: PTE Retell Lecture / Describe Image
// ---------------------------------------------------------------------------

interface PteSpeakingTask {
  variant: "PTE_RETELL" | "PTE_DESCRIBE_IMAGE";
  prompt: string;
  content: string[];
  coverage3: string;
  coverage2: string;
  coverage1: string;
}

const PTE_SPEAKING_TASKS: PteSpeakingTask[] = [
  {
    variant: "PTE_RETELL",
    prompt: "You will hear a short lecture. After the lecture finishes, retell what the lecturer talked about in your own words.",
    content: ["the lecture traced the history of the postal service from the invention of the stamp to the arrival of email", "the key point was that prepaid postage made correspondence affordable for ordinary people", "the lecturer closed by noting that railways then telephones and finally the internet transformed how fast news travelled"],
    coverage3: "The lecture was about the history of the postal service. It explained that prepaid stamps made posting letters affordable for ordinary people, and that railways, telephones, and the internet each transformed how quickly news travelled.",
    coverage2: "The lecture was about the postal service. The main point was that prepaid stamps made posting affordable, and railways and telephones later changed how fast news travelled.",
    coverage1: "The lecture was about the post office and stamps. It was interesting to learn how letters are sent.",
  },
  {
    variant: "PTE_RETELL",
    prompt: "You will hear a short lecture. After the lecture finishes, retell what the lecturer talked about in your own words.",
    content: ["the lecture examined how urban green spaces affect health and the climate", "it presented evidence that parks reduce stress and cool neighbourhoods during heatwaves", "it concluded that planners should treat green infrastructure as a standard part of new housing developments"],
    coverage3: "The lecture discussed urban green spaces. It said parks reduce stress and keep neighbourhoods cooler during heatwaves, and it concluded that green infrastructure should be standard in new housing developments.",
    coverage2: "The lecture was about parks in cities. It said that green spaces reduce stress and cool the area during hot weather.",
    coverage1: "The lecture was about parks and trees. It talked about how nature is good for people.",
  },
  {
    variant: "PTE_DESCRIBE_IMAGE",
    prompt: "Look at the graph and describe the main trends. You will have 40 seconds to prepare and 40 seconds to respond.",
    content: ["the line graph shows visitor numbers for three museums between 2010 and 2020", "the national museum grew steadily from two million to three and a half million visitors", "the science museum peaked in 2016 and then declined, while the art gallery remained roughly stable"],
    coverage3: "The line graph shows the number of visitors to three museums from 2010 to 2020. In general, the national museum grew steadily, reaching about three and a half million, whereas the science museum peaked in 2016 and fell afterwards, and the art gallery stayed roughly stable throughout.",
    coverage2: "The graph shows visitors to three museums over ten years. The national museum went up steadily, but the science museum went down after 2016.",
    coverage1: "The graph is about museums. Most museums had a lot of visitors.",
  },
  {
    variant: "PTE_DESCRIBE_IMAGE",
    prompt: "Look at the chart and describe the main trends. You will have 40 seconds to prepare and 40 seconds to respond.",
    content: ["the bar chart compares energy sources used for electricity in two countries in 2025", "renewables accounted for half of all generation in country A but only a fifth in country B", "coal remained the largest single source in country B at forty per cent"],
    coverage3: "The bar chart compares electricity sources in two countries in 2025. Renewables produced half of the power in country A but only about a fifth in country B, where coal remained the largest single source at forty per cent.",
    coverage2: "The chart compares electricity in two countries. Country A used more renewable energy than country B, which still relied heavily on coal.",
    coverage1: "The chart shows electricity. Renewable energy was important in one country.",
  },
];

function buildPteSpeaking(rng: ReturnType<typeof makeRng>, band: number, task: PteSpeakingTask): string {
  const tier = tierOf(band);
  let text: string;
  if (tier === "high") {
    text = task.coverage3;
  } else if (tier === "mid") {
    text = task.coverage2;
  } else {
    text = task.coverage1;
  }
  if (tier === "low") {
    const words = text.split(" ");
    const filler = rng.pick(["um", "uh", "like"]);
    words.splice(rng.int(2, 5), 0, filler);
    text = words.join(" ");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Assemble the dataset
// ---------------------------------------------------------------------------

const BANDS: number[] = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5];
const PTE_BANDS: number[] = [5.5, 6, 6.5, 7, 7.5, 8];

function buildWritingSamples(): SyntheticWritingSample[] {
  const samples: SyntheticWritingSample[] = [];
  TASK2_TOPICS.forEach((topic, t) => {
    BANDS.forEach((band) => {
      const rng = makeRng(1000 + t * 100 + band * 10);
      samples.push({
        name: `t2-${band.toFixed(1).replace(".", "-")}-${t + 1}`,
        variant: "TASK2_ESSAY",
        prompt: `${topic.subject.charAt(0).toUpperCase() + topic.subject.slice(1)}. Do you agree or disagree? Give reasons for your answer and include relevant examples from your own knowledge or experience. Write at least 250 words.`,
        essay: buildTask2Essay(rng, band, topic),
        expectedIelts: band,
        expectedPte: pteFromIelts(band),
      });
    });
  });
  LETTER_SCENARIOS.forEach((scenario, s) => {
    BANDS.forEach((band) => {
      const rng = makeRng(2000 + s * 100 + band * 10);
      samples.push({
        name: `lt-${band.toFixed(1).replace(".", "-")}-${s + 1}`,
        variant: "GT_LETTER",
        prompt: `Your task is to ${scenario.purpose}. In your letter: ${scenario.bullets.map((b) => `• ${b}`).join(" ")}. Write at least 150 words.`,
        essay: buildLetter(rng, band, scenario),
        expectedIelts: band,
        expectedPte: pteFromIelts(band),
      });
    });
  });
  CHART_DATA.forEach((chart, c) => {
    BANDS.forEach((band) => {
      const rng = makeRng(3000 + c * 100 + band * 10);
      samples.push({
        name: `t1-${band.toFixed(1).replace(".", "-")}-${c + 1}`,
        variant: "ACADEMIC_TASK1",
        prompt: `The charts show ${chart.title}. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.`,
        essay: buildTask1(rng, band, chart),
        expectedIelts: band,
        expectedPte: pteFromIelts(band),
      });
    });
  });
  PASSAGES.forEach((passage, p) => {
    BANDS.forEach((band) => {
      const rng = makeRng(4000 + p * 100 + band * 10);
      samples.push({
        name: `swt-${band.toFixed(1).replace(".", "-")}-${p + 1}`,
        variant: "PTE_SUMMARIZE",
        prompt: `Summarize the passage in one sentence. Write about 20 to 30 words.\n\n${passage.passage}`,
        essay: buildSummarize(rng, band, passage),
        expectedIelts: band,
        expectedPte: Math.min(80, pteFromIelts(band)),
      });
    });
  });
  return samples;
}

function buildSpeakingSamples(): SyntheticSpeakingSample[] {
  const samples: SyntheticSpeakingSample[] = [];
  SPEAKING_PROMPTS.forEach((prompt, p) => {
    BANDS.forEach((band) => {
      const rng = makeRng(5000 + p * 100 + band * 10);
      const transcript = buildPart2(rng, band, prompt);
      samples.push({
        name: `sp-${band.toFixed(1).replace(".", "-")}-${p + 1}`,
        variant: "IELTS_PART2",
        prompt: prompt.prompt,
        transcript,
        durationSec: Math.max(
          band >= 7.5 ? 60 : band >= 6 ? 50 : 40,
          Math.round((transcript.split(/\s+/).length / (band >= 7.5 ? 150 : band >= 6 ? 130 : 105)) * 60)
        ),
        expectedIelts: band,
        expectedPte: pteFromIelts(band),
      });
    });
  });
  PTE_SPEAKING_TASKS.forEach((task, t) => {
    PTE_BANDS.forEach((band) => {
      const rng = makeRng(6000 + t * 100 + band * 10);
      const transcript = buildPteSpeaking(rng, band, task);
      samples.push({
        name: `pte-sp-${band.toFixed(1).replace(".", "-")}-${t + 1}`,
        variant: task.variant,
        prompt: task.prompt,
        transcript,
        durationSec: task.variant === "PTE_RETELL" ? Math.max(40, Math.round((transcript.split(/\s+/).length / 140) * 60)) : 40,
        expectedIelts: band,
        expectedPte: pteFromIelts(band),
      });
    });
  });
  return samples;
}

export const SYNTHETIC_WRITING: SyntheticWritingSample[] = buildWritingSamples();
export const SYNTHETIC_SPEAKING: SyntheticSpeakingSample[] = buildSpeakingSamples();

export const SYNTHETIC_TOTAL = SYNTHETIC_WRITING.length + SYNTHETIC_SPEAKING.length;

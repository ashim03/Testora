export interface EvalWritingSample {
  name: string;
  prompt: string;
  essay: string;
  expectedIelts: number;
}

export interface EvalSpeakingSample {
  name: string;
  prompt: string;
  transcript: string;
  durationSec: number;
  expectedIelts: number;
}

export const EVAL_WRITING: EvalWritingSample[] = [
  {
    name: "strong-band-8",
    prompt: "Technology has made communication between people less meaningful. To what extent do you agree or disagree?",
    expectedIelts: 8,
    essay: `Technology has transformed the way people communicate, making it faster, easier, and more convenient than ever before. However, some people argue that this development has made communication less meaningful. I largely agree with this view because digital communication can reduce personal interaction and encourage superficial relationships, although technology also provides valuable opportunities to stay connected.
One major reason why communication has become less meaningful is the growing dependence on messaging and social media. People often send short messages, emojis, or reactions instead of having detailed conversations. As a result, important emotions and ideas can be misunderstood or ignored. For example, a person may reply to a friend's personal problem with a simple emoji rather than taking the time to listen and provide emotional support. Face-to-face conversations, in contrast, allow people to understand tone, facial expressions, and body language, which can make relationships stronger.
Furthermore, social media can create an illusion of social connection. People may have hundreds of online friends or followers but still have very few close relationships. Many users also communicate mainly by sharing photographs, short videos, or status updates rather than discussing their genuine feelings. In my experience, conversations with friends are generally more enjoyable and meaningful when we meet in person because we can speak freely and respond naturally to each other's emotions.
Nevertheless, technology is not entirely responsible for weaker communication. It has made it possible for families and friends living far apart to remain in regular contact. Video calls, for instance, allow people to see and speak to loved ones even when they live in different countries. Technology is also extremely useful for education and professional communication.
In conclusion, although technology has made communication more convenient and helped people remain connected across distances, I believe it has reduced the depth and quality of many everyday interactions. People should therefore use technology as a tool for communication rather than allowing it to replace meaningful personal relationships.`,
  },
  {
    name: "mid-band-6.5",
    prompt: "Some people think that children should start school at a very early age, while others believe they should begin at least seven years old. Discuss both views and give your own opinion.",
    expectedIelts: 6.5,
    essay: `There is a debate about the best age for children to start school. Some people think early education is good for children, but other people believe children should start school when they are seven years old. In this essay I will discuss both opinions and give my view.
On the one hand, starting school early has some benefits. Children can learn reading and writing faster when they are young. Also, they learn how to be with other children and share things. Parents who work can send their children to school and feel less worried. Many studies show that children who start school early do better in tests later.
On the other hand, some experts think young children need more time to play and develop. When children start school too early, they can feel stressed and tired. They may lose interest in learning. At the age of seven, children are more mature and can concentrate for longer time. They can also understand the teacher better and make friends easily.
In my opinion, children should start school at a moderate age, maybe five or six years old. They need some early education but they also need time to play. Parents and teachers should focus on making learning fun instead of pushing children too hard.
In conclusion, both early and late schooling have advantages and disadvantages. I believe the best approach is to start school at a reasonable age and keep the balance between education and play.`,
  },
  {
    name: "weak-band-5.5",
    prompt: "Many people today are choosing to work from home instead of going to an office. Is this a positive or negative development?",
    expectedIelts: 5.5,
    essay: `Today many people work from home. I think it is good and bad. There are many reason. First reason is people save time. They don't need to travel to office every day. This is good because they have more time for family. Also they can work in their own pace. But there is also problems. When people work from home they feel lonely. They don't talk to colleagues. Also it is difficult to focus at home because there is many distraction like television and children. And some people cannot separate work and home life. They work all the time and feel tired. In my opinion working from home is good but only if people have discipline. Companies should also support their workers. To conclude working from home has positives and negatives. I think in future more people will work from home but we must careful about the problems.`,
  },
  {
    name: "offtopic-ignores-prompt",
    prompt: "Some people believe that university education should be free for everyone. To what extent do you agree or disagree?",
    expectedIelts: 4.5,
    essay: `Global warming is one of the most serious problems facing the world today. The temperature of the earth is rising because of carbon emissions from cars and factories. This causes ice to melt at the poles, and sea levels are rising, which threatens coastal cities. Governments must invest in renewable energy such as solar and wind power to reduce emissions. Individuals can also help by using public transport, saving electricity, and planting trees. If we do not act now, the consequences will be devastating for future generations.`,
  },
];

export const EVAL_SPEAKING: EvalSpeakingSample[] = [
  {
    name: "fluent-answer",
    prompt: "Describe a place you like to visit. You should say where it is, when you go there, and why you enjoy it.",
    expectedIelts: 7.5,
    durationSec: 62,
    transcript: `The place I enjoy visiting most is the old library near the river. I usually go there on Sunday mornings because it is quiet and the light is beautiful. I like it because I can read, think, and work without interruptions. The staff are friendly and they always help me find the books I need. There is also a small café upstairs where I sometimes have tea with friends. For me, the library is a place where I can relax and focus at the same time, and I always leave feeling refreshed.`,
  },
  {
    name: "halting-fillers",
    prompt: "Describe a time you helped someone. What happened and how did you feel?",
    expectedIelts: 5.5,
    durationSec: 58,
    transcript: `Um, last year I, uh, I helped my friend with, um, moving to a new apartment. And, uh, it was, like, really hard because, um, the apartment was on the fifth floor, and, uh, there was no elevator. So, um, we carry... we carried the boxes, like, one by one, and, uh, it took, um, almost the whole day. I felt, um, tired but, uh, happy because, like, he said thank you. Yeah, that's, um, what happened.`,
  },
];

export interface EvalSummary {
  writing: Array<{ name: string; expected: number; predicted: number | null; error: number | null; skillScores: Record<string, number> }>;
  speaking: Array<{ name: string; expected: number; predicted: number | null; error: number | null; fluency: number; grammar: number; vocabulary: number; coherence: number; taskResponse: number | null }>;
  writingMae: number | null;
  speakingMae: number | null;
  ranAt: string;
}
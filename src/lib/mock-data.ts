import type {
  ApiSession,
  ApiQuestion,
  ApiTurn,
  ApiReport,
  GapMap,
  ResumeReadiness,
  SessionSummary,
} from "./api";

export const mockResumeReadiness: ResumeReadiness = {
  score: 63,
  verdict:
    "Strong analytics foundation with real numbers, but it reads like payments operations rather than an analyst who owns experimentation.",
  dimensions: {
    structure: {
      score: 72,
      note: "Roles and dates are easy to find, but the first scan is pulled toward billing rather than the measurement work this JD leads with.",
    },
    clarity: {
      score: 78,
      note: "Lines like “cut manual corrections by 70%” are concrete and short; “partnered with finance” is the vaguest bullet.",
    },
    measurable_outcomes: {
      score: 58,
      note: "Only “cut manual corrections by 70%” and “lifted repeat checkout conversion by 6%” carry numbers.",
    },
    keyword_alignment: {
      score: 41,
      note: "You match SQL and dashboards, but the JD's “A/B tests”, “north-star metrics” and “warehouse modelling” never appear.",
    },
  },
  missing_keywords: [
    "A/B tests",
    "north-star metrics",
    "experimentation",
    "warehouse modelling",
    "roadmap",
  ],
  fixes: [
    {
      kind: "rewrite",
      where: "Built the checkout funnel dashboard in Looker, now used weekly by 4 product teams.",
      fix: "Built a self-serve checkout funnel dashboard in Looker, used weekly by 4 product teams to cut ad-hoc data requests by [X%].",
      why: "Borrows the JD's “self-serve dashboards” wording for work you already did.",
    },
    {
      kind: "rewrite",
      where: "Partnered with finance on the monthly close.",
      fix: "Partnered with finance on the monthly close, delivering it [X days] faster.",
      why: "Turns an activity into evidence of the stakeholder impact the JD asks for.",
    },
    {
      kind: "add_if_true",
      where: "Product Analyst, PayQuick (2022 - present)",
      fix: "If the saved-cards launch was measured against a control group, say “A/B test” explicitly in that bullet.",
      why: "Experimentation is the JD's first responsibility and nothing on the resume shows it yet.",
    },
  ],
};

export const mockGapMap: GapMap = [
  {
    requirement: "Measurement design",
    status: "strong",
    evidence: "“Built checkout funnel measurement”",
  },
  {
    requirement: "Stakeholder management",
    status: "strong",
    evidence: "“Ran the weekly working group with finance”",
  },
  {
    requirement: "Delivery ownership",
    status: "partial",
    evidence: "“Owned billing reconciliation migration”",
  },
  {
    requirement: "Experimentation depth",
    status: "missing",
    evidence: "No A/B testing or experiment design on the resume",
  },
  {
    requirement: "Warehouse modelling",
    status: "missing",
    evidence: "No dbt or warehouse modelling mentioned",
  },
];

export const mockQuestions = (sessionId: string): ApiQuestion[] => [
  {
    id: `${sessionId}-q1`,
    session_id: sessionId,
    text: "Walk me through your background and what draws you to this role.",
    type: "behavioural",
    difficulty: "easy",
    order_index: 0,
  },
  {
    id: `${sessionId}-q2`,
    session_id: sessionId,
    text: "Tell me about a project where you owned delivery end to end. What was your specific contribution?",
    type: "behavioural",
    difficulty: "medium",
    order_index: 1,
  },
  {
    id: `${sessionId}-q3`,
    session_id: sessionId,
    text: "This role leans heavily on measuring impact. How have you decided what to track, and what did you do when the numbers disagreed with you?",
    type: "role_specific",
    difficulty: "medium",
    order_index: 2,
  },
  {
    id: `${sessionId}-q4`,
    session_id: sessionId,
    text: "Describe how you'd set up reporting for a brand-new product surface in your first month.",
    type: "role_specific",
    difficulty: "hard",
    order_index: 3,
  },
  {
    id: `${sessionId}-q5`,
    session_id: sessionId,
    text: "The role leans on experimentation. Walk me through how you'd design your first A/B test here.",
    type: "gap_targeted",
    difficulty: "hard",
    order_index: 4,
  },
];

export const mockTurns = (sessionId: string): ApiTurn[] => {
  const qs = mockQuestions(sessionId);
  const base = Date.parse("2026-09-18T10:02:00Z");
  const turns: ApiTurn[] = [];
  const answers = [
    "I've spent the last four years in product analytics, most recently leading the reporting side of a payments team. I'm drawn to this role because it pairs measurement with real product decisions.",
    "I led the migration of our billing reconciliation pipeline. I wrote the spec, ran the weekly working group, and personally rebuilt the matching logic that cut manual corrections by about seventy percent.",
    "I start from the decision, not the metric. For the checkout rework we tracked completion by step. When the numbers showed the drop was on the address step and not on payment, I dropped my original hypothesis and reprioritised.",
    "A stakeholder wanted a dashboard shipped before the data model was stable. I showed them two weeks of variance, agreed on a narrow read-only view first, and we shipped the full version a sprint later.",
    "Our nightly aggregation fell over at about ten times volume — a single-threaded join. I'd partition by merchant from the start now, and I'd have load-tested with realistic skew rather than uniform data.",
  ];
  qs.forEach((q, i) => {
    turns.push({
      id: `${sessionId}-t${i}a`,
      session_id: sessionId,
      question_id: q.id,
      speaker: "interviewer",
      text: q.text,
      is_followup: false,
      started_at: new Date(base + i * 150000).toISOString(),
    });
    turns.push({
      id: `${sessionId}-t${i}b`,
      session_id: sessionId,
      question_id: q.id,
      speaker: "candidate",
      text: answers[i] ?? "",
      is_followup: false,
      started_at: new Date(base + i * 150000 + 40000).toISOString(),
    });
  });
  return turns;
};

export const mockReport = (sessionId: string, overall = 74): ApiReport => ({
  id: `${sessionId}-report`,
  session_id: sessionId,
  overall_score: overall,
  verdict_line:
    "Solid, credible answers — you lose points on structure and specifics, not on substance.",
  what_worked: [
    "You opened with a clear one-line summary of your background before going deeper.",
    "Concrete numbers on the reconciliation project (70% fewer manual corrections) made the impact believable.",
    "You changed your mind when the data disagreed with you, and said so out loud.",
    "Your tone stayed calm and steady, even on the harder scaling question.",
  ],
  what_didnt_work: [
    "Two answers ran past two minutes without a signposted structure.",
    'You said "we" far more than "I" — the interviewer can\'t tell what you personally did.',
    "The stakeholder-disagreement answer ended without a result.",
    "You skipped the job description's emphasis on experimentation entirely.",
  ],
  strengths: [
    {
      trait: "Decision-first thinking on metrics",
      evidence: "“I start from the decision, not the metric.”",
    },
    {
      trait: "Genuine ownership of delivery",
      evidence: "“I personally rebuilt the matching logic.”",
    },
    {
      trait: "Changes course on evidence",
      evidence: "“I dropped my original hypothesis and reprioritised.”",
    },
  ],
  weaknesses: [
    {
      pattern: "Answers run long without structure",
      fix: "Use situation → my decision → the number, capped at 90 seconds.",
    },
    {
      pattern: "Under-claiming your own contribution",
      fix: "Swap every “we” for “I” plus what the team did around you.",
    },
    {
      pattern: "Endings without a result",
      fix: "Close every story with what shipped and how it landed.",
    },
  ],
  communication: {
    filler_word_count: 24,
    avg_words_per_answer: 118,
    pace_wpm: 158,
    used_star_structure: false,
  },
  jd_fit_summary:
    "You map well to the analytics and ownership half of this job description: measurement design, stakeholder handling, and shipping under constraint all came through with real examples. The gap is the experimentation and platform half — the description leads on A/B testing and warehouse modelling, and neither appeared in your answers. On current evidence a hiring manager would read you as a strong analyst who needs to prove experimentation depth in a second round.",
  top_3_actions: [
    "Rehearse three stories in a fixed shape: situation, my decision, the number it moved. Cap each at 90 seconds.",
    'Rewrite every "we" in your two best stories as "I" plus what the team did around you.',
    "Prepare one experimentation story — hypothesis, design, guardrail metric, what you shipped — and use it on any measurement question.",
  ],
  per_question: mockQuestions(sessionId).map((q, i) => ({
    question_id: q.id,
    question: q.text,
    answer_text: mockTurns(sessionId).filter((t) => t.speaker === "candidate")[i]?.text ?? "",
    score: [8, 7, 8, 5, 6][i] ?? 7,
    what_was_missing:
      [
        ["A sharper line on why this company specifically, not just the role."],
        ["The outcome for the business, not just the process you ran."],
        ["A guardrail metric, and what you chose not to optimise."],
        ["The result — what shipped and how it landed."],
        ["A sample-size estimate", "A guardrail metric"],
      ][i] ?? [],
    model_answer:
      [
        "Anchor in one line: 'Four years in product analytics, last two owning payments reporting.' Then one proof point with a number, then one sentence connecting your strongest skill to this team's stated priority.",
        "Situation in one sentence, then 'I decided…' twice, then the number. Close with what you'd hand to the next owner.",
        "Name the decision the metric served, the guardrail you refused to break, and the moment the data overruled you — then the concrete reprioritisation and its result.",
        "Use the tension, your move, the agreement, and the result: 'We shipped the read-only view in five days, the full dashboard a sprint later, and it became the team's weekly review surface.'",
        "Name the failure mode precisely, the fix, the new load profile it survived, and the monitoring you added so it couldn't regress silently.",
      ][i] ?? "",
  })),
  reduced: false,
  created_at: new Date().toISOString(),
});

export const mockSessionHistory: SessionSummary[] = [
  {
    id: "demo-session-3",
    role_title: "Senior Product Analyst — Fintech",
    mode: "voice",
    status: "completed",
    started_at: "2026-09-18T10:02:00Z",
    duration_seconds: 1_140,
    overall_score: 74,
  },
  {
    id: "demo-session-2",
    role_title: "Product Analyst — Marketplace",
    mode: "voice",
    status: "completed",
    started_at: "2026-09-11T17:20:00Z",
    duration_seconds: 960,
    overall_score: 68,
  },
  {
    id: "demo-session-1",
    role_title: "Data Analyst — Payments",
    mode: "text",
    status: "completed",
    started_at: "2026-09-02T08:45:00Z",
    duration_seconds: 720,
    overall_score: 59,
  },
];

export const mockSession = (id: string, overrides: Partial<ApiSession> = {}): ApiSession => ({
  id,
  role_title: "Senior Product Analyst — Fintech",
  jd_text:
    "We're looking for a senior product analyst to own measurement across our payments surface: experiment design, warehouse modelling, and partnering with product on roadmap decisions.",
  mode: "voice",
  status: "completed",
  candidate_first_name: "Aniket",
  resume_id: null,
  gap_map: mockGapMap,
  resume_readiness: mockResumeReadiness,
  started_at: "2026-09-18T10:02:00Z",
  ended_at: "2026-09-18T10:21:00Z",
  duration_seconds: 1_140,
  ...overrides,
});

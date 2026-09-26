/**
 * Seeds one fake interview that has finished but has no report yet, for testing
 * POST /api/sessions/:id/report without doing a live interview.
 *
 *   npm run seed:fake -- you@example.com
 *
 * The email must belong to an existing user in this Supabase project.
 */
import { supabaseAdmin } from "../lib/supabase.js";

const RESUME = `Priya Sharma
Product Analyst | priya.sharma@example.com | Bengaluru

EXPERIENCE
Product Analyst, PayQuick (Mar 2022 - present)
- Owned the billing reconciliation migration from spreadsheets to dbt; cut manual corrections by 70%.
- Built the checkout funnel dashboard in Looker, now used weekly by 4 product teams.
- Wrote SQL and dbt models for payments data; partnered with finance on the monthly close.
- Ran the analysis behind the saved-cards launch, which lifted repeat checkout conversion by 6%.

Data Analyst Intern, ShopLane (Jun 2021 - Dec 2021)
- Cleaned marketplace seller data in Python (pandas) and automated a weekly seller-health report.

EDUCATION
B.Tech, Computer Science, VIT (2021)

SKILLS
SQL, dbt, Python (pandas), Looker, Excel, stakeholder presentations`;

const JD = `Senior Product Analyst - Lending (Fintech)
You will own product analytics for our lending product.
Responsibilities: design and analyse A/B tests for onboarding and credit flows; define and track north-star metrics;
build self-serve dashboards; partner with product managers to shape the roadmap with data; mentor junior analysts.
Requirements: 4+ years in product analytics; expert SQL; hands-on experience with experimentation and statistical testing;
Python or R; experience in lending or credit risk is a strong plus; excellent stakeholder communication.`;

const GAP_MAP = [
  { requirement: "expert SQL", status: "strong", evidence: "Wrote SQL and dbt models for payments data" },
  { requirement: "Python or R", status: "strong", evidence: "Cleaned marketplace seller data in Python (pandas)" },
  { requirement: "excellent stakeholder communication", status: "partial", evidence: "partnered with finance on the monthly close" },
  { requirement: "4+ years in product analytics", status: "partial", evidence: "Product Analyst since Mar 2022 (~3.5 years incl. internship)" },
  { requirement: "hands-on experience with experimentation and statistical testing", status: "missing", evidence: "No A/B testing or statistical testing on the resume" },
  { requirement: "experience in lending or credit risk", status: "missing", evidence: "Payments and marketplace only; no lending or credit" },
];

const QUESTIONS = [
  { text: "To start, could you walk me through your background and what's drawn you to this lending role?", type: "behavioural", difficulty: "easy" },
  { text: "Tell me about a time you had to get a sceptical stakeholder to act on your analysis.", type: "behavioural", difficulty: "medium" },
  { text: "How would you define a north-star metric for a consumer lending product?", type: "role_specific", difficulty: "medium" },
  { text: "Walk me through how you'd design an A/B test for a change to our loan onboarding flow.", type: "role_specific", difficulty: "hard" },
  { text: "What hands-on experience do you have with statistical testing, and how would you close that gap quickly?", type: "gap_targeted", difficulty: "hard" },
] as const;

// [questionIndex, speaker, text, isFollowup, seconds spoken]
const SCRIPT: [number, "interviewer" | "candidate", string, boolean, number][] = [
  [0, "interviewer", "Hi Priya, thanks for joining. To start, could you walk me through your background and what's drawn you to this lending role?", false, 8],
  [0, "candidate", "Sure. So I'm currently a product analyst at PayQuick, I've been there about three and a half years. Um, mostly payments. The big thing I did was the billing reconciliation migration, we moved it off spreadsheets onto dbt and it cut manual corrections by about seventy percent. Before that I interned at ShopLane doing seller data in Python. Lending interests me because it's, you know, the next step after payments, the decisions are higher stakes.", false, 34],
  [0, "interviewer", "You said the migration cut manual corrections by seventy percent. What was your specific part in that?", true, 6],
  [0, "candidate", "I designed the dbt models and the reconciliation checks, and I basically ran the rollout with finance. The engineers helped with the pipeline scheduling but the logic was mine.", true, 14],
  [1, "interviewer", "Tell me about a time you had to get a sceptical stakeholder to act on your analysis.", false, 5],
  [1, "candidate", "Uh, yeah. There was a time finance didn't trust the new numbers. I kind of just kept showing them the dashboard until they came around. It took a while.", false, 13],
  [1, "interviewer", "What specifically changed their mind, and what happened as a result?", true, 5],
  [1, "candidate", "I think, um, I did a side-by-side for one month showing every difference between the old spreadsheet and the new model, and explained each one. After that they signed off and we switched the month-end close to the new process.", true, 17],
  [2, "interviewer", "How would you define a north-star metric for a consumer lending product?", false, 5],
  [2, "candidate", "I'd probably look at something like loans disbursed that are repaid on time, because just disbursing more loans isn't good if they default. So maybe on-time repayment volume. I'd pair it with approval rate and default rate as guardrails.", false, 19],
  [2, "interviewer", "Why on-time repayment volume rather than, say, revenue?", true, 4],
  [2, "candidate", "Revenue can go up if you lend riskier, which looks good short term but hurts later. Repayment volume captures both growth and quality.", true, 11],
  [3, "interviewer", "Walk me through how you'd design an A/B test for a change to our loan onboarding flow.", false, 6],
  [3, "candidate", "So I'd, um, split users randomly into control and treatment, and then compare the completion rate of onboarding. I'd run it for, like, a couple of weeks. And then see which one is better.", false, 16],
  [3, "interviewer", "How would you decide how long to run it and whether the result is real?", true, 5],
  [3, "candidate", "Honestly I'd probably ask the data science team for the sample size. I know you need statistical significance but I haven't calculated it myself before.", true, 12],
  [4, "interviewer", "What hands-on experience do you have with statistical testing, and how would you close that gap quickly?", false, 7],
  [4, "candidate", "I don't have much hands-on, to be honest. For the saved-cards launch we looked at before and after, it lifted repeat checkout by six percent, but it wasn't a proper test. I'd close the gap by taking a course on experimentation and pairing with a data scientist on the first few tests.", false, 22],
  [4, "interviewer", "If you had to start this week, what would be the first thing you'd do?", true, 4],
  [4, "candidate", "I'd rerun the saved-cards analysis as if it were a test, work out what sample size we would have needed, and ask someone to review it.", true, 11],
  [4, "interviewer", "Thanks Priya, that's all my questions. The interview is now complete.", false, 5],
];

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run seed:fake -- you@example.com");

  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Listing users failed: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No user with email ${email} in this Supabase project. Sign up in the app first.`);

  const { data: resume, error: rErr } = await supabaseAdmin
    .from("resumes")
    .insert({ user_id: userId, file_url: null, extracted_text: RESUME })
    .select("id")
    .single();
  if (rErr) throw new Error(`Resume insert failed: ${rErr.message}`);

  const start = Date.now() - 20 * 60 * 1000;
  const { data: session, error: sErr } = await supabaseAdmin
    .from("sessions")
    .insert({
      user_id: userId,
      resume_id: resume.id,
      role_title: "Senior Product Analyst - Lending",
      jd_text: JD,
      gap_map: GAP_MAP,
      candidate_first_name: "Priya",
      mode: "voice",
      status: "in_progress",
      started_at: new Date(start).toISOString(),
    })
    .select("id")
    .single();
  if (sErr) throw new Error(`Session insert failed: ${sErr.message}`);

  const { data: questions, error: qErr } = await supabaseAdmin
    .from("questions")
    .insert(QUESTIONS.map((q, i) => ({ ...q, session_id: session.id, order_index: i })))
    .select("id, order_index")
    .order("order_index");
  if (qErr || !questions) throw new Error(`Questions insert failed: ${qErr?.message}`);

  // Lay turns out on a realistic timeline: each turn lasts its spoken seconds, ~2s gap between turns.
  let t = start;
  const asked = new Map<number, string>();
  const turns = SCRIPT.map(([qi, speaker, text, isFollowup, secs]) => {
    const started_at = new Date(t).toISOString();
    t += secs * 1000;
    const ended_at = new Date(t).toISOString();
    t += 2000;
    if (speaker === "interviewer" && !isFollowup && !asked.has(qi)) asked.set(qi, started_at);
    return { session_id: session.id, question_id: questions[qi]!.id, speaker, text, is_followup: isFollowup, started_at, ended_at };
  });
  const { error: tErr } = await supabaseAdmin.from("turns").insert(turns);
  if (tErr) throw new Error(`Turns insert failed: ${tErr.message}`);
  for (const [qi, at] of asked) await supabaseAdmin.from("questions").update({ asked_at: at }).eq("id", questions[qi]!.id);

  console.log(`Seeded fake interview for ${email}`);
  console.log(`  resume_id:  ${resume.id}`);
  console.log(`  session_id: ${session.id}`);
  console.log(`  ${turns.length} turns across ${questions.length} questions`);
  console.log(`\nGenerate the report:\n  curl.exe -X POST http://localhost:4000/api/sessions/${session.id}/report -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

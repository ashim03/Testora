# Testora Product & Performance Roadmap

This roadmap turns the next eight product areas into independently shippable workstreams. The existing platform already has exams, assignments, attempts, grading, notifications, batches, reporting, media uploads, and activity/audit logging, so these additions should build on those primitives rather than introduce parallel systems.

## 1. Adaptive practice engine

Goal: recommend practice based on recent performance rather than a fixed list.

Implementation:
- Track per-question/category/part accuracy and recent attempts.
- Calculate a lightweight mastery score with recency weighting.
- Prefer weak categories, then unseen questions, while avoiding immediate repeats.
- Return a bounded practice set with an explanation such as `Focus: Reading inference`.
- Keep recommendation generation deterministic and server-side so it is testable.

Acceptance criteria:
- Recommendation endpoint returns a stable set for the same student state.
- Repeated requests do not repeatedly recommend recently completed questions.
- No question outside the student's permitted teacher/course scope is returned.

## 2. Student progress analytics

Goal: give students an actionable view of improvement.

Metrics:
- Overall score and rolling score trend.
- Accuracy by category and section/part.
- Completion rate.
- Average time per question where timing data exists.
- Weakest three areas and recommended next practice.

Use aggregated queries rather than loading every answer into the client.

## 3. AI writing/speaking feedback

Goal: provide optional assisted feedback for writing and speaking submissions.

Architecture:
- Store an immutable submission snapshot and rubric version.
- Run AI evaluation asynchronously.
- Persist structured scores plus short evidence-based feedback.
- Never replace the teacher's final grade automatically.
- Add provider/model/version metadata for reproducibility.
- Add rate limits and feature flags so AI costs are controllable.

For speaking, reuse the existing audio/media pipeline and generate feedback only after the upload is complete.

## 4. Question-bank bulk import/export

Goal: allow teachers/admins to manage large question banks efficiently.

Import flow:
1. Upload CSV/XLSX.
2. Validate headers and question types.
3. Validate answers/options/media references.
4. Show a dry-run report with row-level errors.
5. Commit valid rows in a transaction/bulk operation.
6. Return an import summary and downloadable error report.

Export should support filters by category, part, difficulty and author.

## 5. Assignment scheduler and reminders

Goal: make scheduled tests operational without manual follow-up.

Implementation:
- Persist `publishAt`, `dueAt`, timezone and reminder policy.
- Background job publishes/activates assignments when due.
- Reminder schedule: configurable before due date and after missed deadlines.
- Use the existing notification service rather than a second notification system.
- Make jobs idempotent so retries cannot send duplicate reminders.

## 6. Mock-test leaderboard

Goal: add optional motivation without exposing private student data.

Rules:
- Leaderboards are opt-in and scoped to a batch/class/consultancy.
- Rank by normalized score, then completion time as a tie-breaker.
- Never expose email or other private profile data.
- Support anonymous display names.
- Cache leaderboard reads for high-traffic mock tests.

## 7. Teacher/cohort analytics

Goal: help teachers identify cohort-level weaknesses.

Dashboard metrics:
- Participation and completion rate.
- Average/median score.
- Category and part accuracy.
- Score distribution.
- Students needing attention.
- Improvement over time.

Prefer server-side aggregation and pagination; do not send raw answer records to the browser.

## 8. Audit/activity history

Goal: provide trustworthy operational history for admin and teacher actions.

Events should include:
- actor and role
- action
- entity type/id
- timestamp
- request/IP metadata where appropriate
- before/after summary for sensitive changes

The platform already has activity/audit helpers in the exam workflow. Extend that existing mechanism consistently instead of creating a second audit model unless the current implementation cannot support retention/query requirements.

## Immediate performance work

The student exam listing currently performs one `ExamAttempt.findOne()` per exam after loading the page of exams. This is an N+1 query pattern. Replace it with one query using the paginated exam IDs and build a `Map` keyed by `examId`; keep only the highest `attemptNumber` per exam.

The practice listing has a similar pattern: it performs both a latest-attempt query and an attempt-count query per exam. That should be converted to one aggregation/query pass as part of the adaptive-practice work.

## Delivery order

1. N+1 query elimination and query-count tests.
2. Student analytics aggregation API.
3. Adaptive practice recommendations.
4. Bulk question import/export.
5. Assignment scheduling/reminders.
6. Cohort analytics.
7. Leaderboards.
8. AI writing/speaking feedback.
9. Harden audit retention/search and expose the activity UI.

Each feature should be delivered as a focused PR with tests rather than combining all eight into one production-risky change.

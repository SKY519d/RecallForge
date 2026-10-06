# RecallForge

RecallForge is a private-account DSA spaced-revision and question tracker. Each account has its own cloud workspace, with a separate per-account browser cache. It turns a solved problem into a clear review plan, encourages retrieval before answer exposure, and keeps the source workbook's fixed checkpoints visible.

## Features

- Dashboard with due and overdue work first, daily progress, upcoming checkpoints, streaks, XP, and topic insights.
- Explainable study suggestions prioritize overdue/due problems, recent difficult recalls, and questions not yet practiced today.
- Question library with title search, topic/difficulty/status filters, sorting, editable details, duplicate warnings, and confirmed deletion.
- Focused review mode with an explicit attempt-before-reveal step, solution and notes reveal, and Again / Hard / Good / Easy outcomes.
- The original **Day 0, 3, 7, 15, 30, 60, and 120** schedule. Review ratings do not skip or stretch canonical checkpoints. “Again” schedules a one-day reinforcement while leaving the canonical dates intact.
- Real review-history charts and a 91-day heatmap, progress milestones, gentle streaks, and meaningful XP.
- Per-account cloud sync, account sign-in, full JSON backup/restore, and Excel question import/export.
- Responsive layout, keyboard search (`Ctrl/Cmd + K`), review shortcuts (`R`, `1`–`4`, `N`), focus mode, and paper, dark/light/system, Petal, and Afterglow themes.
- Personalization for app name, dashboard display name, accent color, and compact or comfortable density.
- Contest planner links to official LeetCode, CodeChef, Codeforces, AtCoder, HackerRank, and Topcoder contest pages; reminders remain local and manually scheduled.
- Fifteen sample DSA questions and clearly seeded sample recall history available through **Settings → Load demo**.

## Source workbook

`DSA_Revision_Tracker_Enhanced-1.xlsx` contains one sheet, **DSA Revision Tracker**. Its headers are `Question Name`, `Date Solved`, `+3 Days`, `+7 Days`, `+15 Days`, `+30 Days`, `+60 Days`, `+120 Days`, `Status`, and `Due Today?`. The revision columns use formulas based on `Date Solved` (`B + interval`); `Due Today?` checks the six future checkpoint columns. The workbook is a blank template with formula-filled rows, not a set of sample questions. Its highlighted header and date-formatted schedule cells distinguish the input and calculated dates.

RecallForge retains those actual intervals and calculates dates as local calendar dates. Day 0 is included in the app's visible seven-step timeline and initial recall flow; the six subsequent dates are the same fixed checkpoints as the workbook.

## Tech stack

- React 18, TypeScript, Vite
- React Router, Zustand, date-fns
- ExcelJS for `.xlsx` import/export
- Recharts, Lucide React, custom CSS
- Vitest for revision and spreadsheet round-trip tests

Account sign-in and workspace storage use Supabase. Application fonts use system fallbacks; questions and review history are scoped to the signed-in account and protected by database row-level security.

## Setup and commands

Use Node.js 22 or a compatible current LTS release.

```bash
npm install
npm run dev
```

Development server: Vite prints the local URL (usually `http://localhost:5173`).

### Configure private accounts and cloud sync

1. Create a Supabase project and open its SQL editor. Run [`supabase/schema.sql`](./supabase/schema.sql) to create the workspace table and per-user row-level security policies.
2. In Supabase Authentication, enable email/password sign-in. Set the project Site URL and allowed redirect URLs to your local address and deployed website URL.
3. Copy `.env.example` to `.env`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and public anon/publishable key. Never put a service-role key in this browser app.
4. Restart Vite after changing environment values. New users can create an account from the sign-in screen; email confirmation follows the Supabase project setting.

Without Supabase environment values, the app opens in local-only mode with no account setup required. Data is saved in this browser and will not sync to other devices. You can configure Supabase later to enable private accounts and cloud sync. The first sign-in on a browser checks for the old shared local workspace. It asks before moving that data into the new account; declining starts an empty account workspace. Existing account workspaces load from Supabase and are never automatically replaced by a browser cache. Settings shows sync status, and sign-out waits for pending cloud writes.

### Publish the website

The app can be deployed as a static Vite site; [`vercel.json`](./vercel.json) provides the SPA route fallback for Vercel. Set the same two public Supabase environment variables in the host's project settings, use `npm run build` as the build command and `dist` as the output directory, and add the deployed URL to Supabase's allowed redirect URLs. A hosting account and Supabase project are required for a live public URL; a local Vite process is only for development.

```bash
npm test
npm run build
npm run preview
```

`npm run build` performs the TypeScript project build and creates the production bundle in `dist/`. Route-level code splitting keeps spreadsheet handling and secondary screens out of the initial dashboard chunk.

## Data and portability

The Zustand store writes each workspace to Supabase and maintains a separate `recallforge-v1:user:<account-id>` browser cache. Questions, checkpoint dates, completed stages, review records, XP, settings, and reward milestones persist across devices. If browser storage is unavailable, the app reports that explicitly; keep a JSON backup as an additional recovery option.

### Excel

From **Settings → Data & portability**, select an `.xlsx` workbook to preview recognized rows before import. The importer looks for question/title and date/schedule headers, including the original workbook's exact headings. It preserves available checkpoint dates, calculates missing ones from the start date, reports rows needing a title, and warns about normalized-title duplicates. Existing questions are not overwritten; users choose whether to include possible duplicates.

Excel export creates a readable **DSA Revision Tracker** worksheet with question details, dates for all seven canonical days, next review, status, completed stages, mastery, tags, and review count. An exported workbook can be imported again without changing schedule dates or the current stage. Detailed review history and settings are preserved in JSON backups rather than the Excel question sheet.

### Backup and reset

**Export Backup** downloads the full application state as JSON. **Import Backup** validates the file and asks before replacing the current account state. **Load Demo** and **Reset RecallForge** also ask before replacing data.

## Revision and rewards

`src/core/revision/` owns pure calendar date calculations and derived due/overdue/mastered states. The sequence is `[0, 3, 7, 15, 30, 60, 120]`; completion on Day 120 marks a question mastered. Manual reviews remain available for mastered questions.

An Again response adds a short one-day reinforcement without mutating the seven canonical dates. Hard, Good, and Easy move to the next fixed checkpoint; Easy never skips a checkpoint. XP is attached to question creation and recorded review work. Daily-goal and weekly-consistency rewards are awarded once for their respective milestones. Streaks are informational—there are no lives, penalties, forced reminders, or missed-day loss mechanics.

## Learning Science Behind RecallForge

- **Spacing:** Distributed practice spreads study across time rather than concentrating it into one session. The University of North Carolina Learning Center describes distributed practice as studying over short sessions across days and weeks. RecallForge keeps the workbook's explicit 3/7/15/30/60/120-day cadence instead of silently substituting an adaptive algorithm.
- **Retrieval before recognition:** The review screen asks learners to attempt the problem before revealing a stored solution. Retrieval practice is associated with better later retention than simply restudying material; the question remains the central activity, not answer browsing.
- **Visible feedback:** Checkpoint timelines, next-review dates, daily counts, and progress charts provide concrete information about completed and upcoming work. They describe the recorded history rather than claiming to predict learning outcomes.
- **Meaningful, gentle rewards:** XP is earned for adding a question or completing an actual review, not for clicking through an empty flow. Streaks and badges are lightweight feedback, not punishment or scarcity. This is a product design choice, not a claim that gamification guarantees improved learning.

Selected references:

1. University of North Carolina at Chapel Hill Learning Center. [Studying 101: Study Smarter, Not Harder](https://learningcenter.unc.edu/tips-and-tools/studying-101-study-smarter-not-harder/). Discusses active studying, self-testing, and distributed practice.
2. Roediger, H. L. III, & Karpicke, J. D. (2006). [Test-enhanced learning: Taking memory tests improves long-term retention](https://doi.org/10.1111/j.1467-9280.2006.01693.x). *Psychological Science, 17*(3), 249–255.
3. Cepeda, N. J., et al. (2006). [Distributed practice in verbal recall tasks: A review and quantitative synthesis](https://doi.org/10.1037/0033-2909.132.3.354). *Psychological Bulletin, 132*(3), 354–380.
4. Hattie, J., & Timperley, H. (2007). [The power of feedback](https://doi.org/10.1111/j.1467-9620.2007.00458.x). *Review of Educational Research, 77*(1), 81–112.
5. Sailer, M., & Homner, L. (2020). [The Gamification of Learning: a Meta-analysis](https://doi.org/10.1007/s10648-019-09498-w). *Educational Psychology Review, 32*, 77–112.

The cited findings concern learning strategies in general; they do not prove that this specific product will improve an individual learner's performance.

## Project architecture

```text
src/
  components/
    common.tsx
    layout/AppLayout.tsx
    questions/QuestionForm.tsx
  core/
    importExport/excel.ts
    rewards/index.ts
    revision/dates.ts
    revision/engine.ts
    revision/engine.test.ts
    storage/localStorage.ts
  data/demoQuestions.ts
  pages/
    AddQuestionPage.tsx
    AnalyticsPage.tsx
    DashboardPage.tsx
    QuestionDetailPage.tsx
    QuestionsPage.tsx
    ReviewPage.tsx
    SettingsPage.tsx
  store/appStore.ts
  types/index.ts
```

The store keeps the revision logic separate from React components; account-scoped persistence handles cloud sync while the local cache remains specific to the signed-in account.

## Tests

`npm test` covers the exact October 1, 2026 schedule, month/year/leap-day boundaries, due and overdue comparisons, mastery at Day 120, derived counts after deletion, and Excel export/import round-trip preservation of dates and completed stages.

## Known limitations

- Data is stored only in the current browser profile; there is no cloud sync or multi-device merge.
- Excel import accepts `.xlsx` workbooks. Legacy `.xls` files should be saved as `.xlsx` before importing.
- Spreadsheet rows contain question and checkpoint data; full review records, reward dates, and settings are available in JSON backups.
- The scheduling cadence is intentionally fixed. Reinforcement after Again is a separate one-day reminder, not a replacement for a canonical checkpoint.

## Future extensions

- Optional encrypted sync behind a user-controlled backend.
- Additional export formats and richer review-history spreadsheet sheets.
- Opt-in accessibility preferences such as larger type and custom contrast.
- An optional, clearly separated adaptive review suggestion layer that never hides or alters the canonical schedule.

# Rise

A monthly muscle check on the phone for people taking GLP-1 medications.

A patient records a 30-second sit-to-stand test with their phone camera. Rise counts the stands on the device, compares the result with the patient's own baseline and with CDC STEADI norms for their age and sex, and tells them one thing to do next. When the plan isn't working, their care team is flagged.

<p>
  <img src="docs/screenshots/01-welcome.png" width="200" alt="Welcome screen">
  <img src="docs/screenshots/10-result-watch.png" width="200" alt="Result screen in Watch state">
  <img src="docs/screenshots/12-home-dark.png" width="200" alt="Home screen in dark mode">
</p>
<img src="docs/screenshots/13-provider-list.png" width="620" alt="Provider check-in list">

## What's in the MVP

**Patient app** (installable web app, built for iPhone)
- **Risk setup:** 9 to 10 questions, one per screen (age, sex, menopause, medication, weight change, activity, falls, joint pain, personal goal, care-team code). Answers set a **Higher** or **Standard** risk tier, which sets how often the patient checks and how sensitive the flags are.
- **Readiness check:** two questions before every check (sleep, pain or illness). A rough day never flags the provider on its own.
- **Camera checks before recording:** lens smudge (image sharpness), too close, too far, side view, lighting, phone steady. One fix at a time, spoken and written. Recording starts by itself when everything passes.
- **Sit-to-stand capture:** on-device pose tracking (MediaPipe), spoken countdown, stands counted aloud, 30-second timer, hip path drawn live. Captures where the legs weren't visible most of the time are rejected with a fix.
- **Personalized result:** Steady, Watch or Check in, a verdict with the patient's name, change since baseline, trend chart, one action matched to their tier and limits (for example chair-based moves for knee pain), their own goal, and a retest date.
- **Body scan:** optional manual entry of lean mass and body fat for now. A phone body-scan SDK (such as Prism Labs or Spren) plugs in here later.
- A manual-count fallback when the camera can't be used, marked as self-reported for providers.

**Provider dashboard**
- Check-in list sorted by urgency, then risk tier; steady patients collapse into one line.
- Patient report: trend against the STEADI norm, every check with capture method and confidence, readiness flags, body scan, the action given, risk tier with the reasons behind it, and setup answers.
- Structured, record-ready export (one observation per check) as JSON.

Product rules are in [`docs/product-principles.md`](docs/product-principles.md), screens in [`docs/screens.md`](docs/screens.md) and the visual system in [`docs/design-system.md`](docs/design-system.md).

## Run it locally

Requires Node 22.5 or later.

```bash
npm run install:all
npm run dev          # API on :3001, app on http://localhost:5173
```

Open http://localhost:5173. Use care-team code **DEMO42** (a demo clinic with six example patients). The provider dashboard is at `/provider`.

**Testing the camera on an iPhone** needs an `https` link. Either deploy (below) or run `npm run dev` and expose port 5173 with a tunnel such as `cloudflared tunnel --url http://localhost:5173`, then open that link in Safari.

Production build, served by the API server:

```bash
npm run build && npm start   # http://localhost:3001
```

Optional: `npm run fetch-model --prefix web` downloads the pose model into the app so it isn't fetched from Google at runtime.

## Deploy

The repo includes a `Dockerfile` and a `render.yaml`. On [Render](https://render.com), create a new Blueprint from this repo; it builds the image and mounts a disk at `/data` for the SQLite database. Any host that runs a Docker container works the same way.

## Tests

```bash
npm test
```

- `server/test/rules.test.js`: risk tiers, STEADI norms, Steady/Watch/Check-in rules, readiness flags and personalized copy.
- `server/test/api.test.js`: intake, checks and provider endpoints end to end.
- `web/src/lib/__tests__`: rep counting, camera checks and image sharpness, light and motion measures.

## Project layout

```
server/   Express API, SQLite (node:sqlite), rules engine, demo seed
web/      React + Vite app: patient app, camera pipeline, provider dashboard
docs/     Product principles, screens, design system, screenshots
```

## Before real patients use it

- **Sign-in.** Providers open their list with a clinic code and patients are remembered on their phone. Add real authentication and access control first.
- **Clinical review.** Risk tiers and Watch/Check-in thresholds are drafts from customer discovery. Set them with clinical advisors.
- **Validation.** Phone-video counting is labeled a pilot measure. Validate it against in-person 30-second chair stands, including older adults and people with obesity.
- **Regulatory and privacy.** Have a regulatory advisor review the flagging logic, and complete a HIPAA review before storing real health data.
- **Body scan.** Replace manual entry with a licensed phone body-scan SDK.

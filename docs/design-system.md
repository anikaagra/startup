Rise is a monthly muscle check on the phone for people taking GLP-1 medications. A patient records a 30-second sit-to-stand test and a phone body scan; Rise shows whether their protein and strength plan is protecting their muscle, tells them the one thing to do next, and flags their provider when it isn't working. Later, the same check helps older adults catch decline before a fall.

The theme is **cyanotype**: the 1840s blueprint print, Prussian blue on white paper, and the chronophotographs of the 1880s that first recorded a body standing up as a row of overlapping frames. Rise does the same thing with a phone camera. Every screen should feel like a clean blue print of the patient's own movement.

Read `product-principles.md` before designing any screen, and `screens.md` for the screen list and flows.

## Who it is for

- **Patients**: adults on a GLP-1, mostly 50 and over, many of them women losing a lot of weight quickly. They are not athletes and not tech-first. They want to know one thing: am I losing fat or muscle?
- **Providers and nurses**: telehealth GLP-1 programs and obesity clinics. They have minutes per patient and no time for another tool. They need a short list of who to check on, and data they can trust.

## Content fundamentals

- Write to the patient as "you"; Rise speaks as "we" only when it explains how the check works.
- Lead with the verdict in plain words, then the number: "You're steady. 13 stands, same as last month."
- Every result ends with one action and a retest date: "Add two strength sessions a week. Check again on Nov 30."
- Personalize to the reader. Patients see their first name, their own goal from setup ("so you can keep up with your grandkids") and actions that fit their limits. Providers see the risk tier and the answers behind it.
- Camera fixes are one short instruction at a time, spoken and written: "Wipe your camera lens", "Move the phone back one step", "Move the phone one step closer".
- Say "check", not "test" or "exam"; "stands", not "repetitions" (patient side). Providers see "reps" and "30-s chair stand".
- Never diagnose. Patient copy says "your muscle may be declining" and "talk to your care team", never "you have sarcopenia".
- Sentence case everywhere except `label` styles, which are uppercase.
- No emoji. No exclamation marks in results. Encouragement is factual: "That's 2 more stands than in August."
- Numbers keep their units: "11 stands in 30 s", "48.2 kg lean mass".

## Visual foundations

**Color.** Set screens on `paper` with cards on `paper-raised`. Text is `ink`; secondary text is `ink-muted`. Use `brand` for the single primary action on a screen, links, and the patient's own trend line. `trace` is reserved for motion: the hip path, rep markers and the Rise Trace chart. `tint` fills selected rows and chart bands, never text.

**Status.** Rise has three states, and each always shows a mark, a word and a color, so it never depends on color alone:

| State | Mark | Word | Tokens | Meaning |
|---|---|---|---|---|
| Steady | circle | Steady | `steady` on `steady-tint` | On track; keep the plan |
| Watch | triangle | Watch | `watch` on `watch-tint` | Change the plan, retest in 4 weeks |
| Check in | square | Check in | `act` on `act-tint` | Provider is flagged |

Steady is blue, not green. That keeps the brand calm and makes the three states readable for people who can't tell red from green.

**Type.** Use Atkinson Hyperlegible Next (`sans`) for all words. It was designed for readers with low vision, which suits patients who are often 50+. Use IBM Plex Mono (`mono`) for every measurement, timer and table number, with `font-variant-numeric: tabular-nums`. Patient body copy is `body-lg` (18px) at minimum; nothing anywhere is smaller than `caption` (14px). One `display-xl` per result screen. Load both faces from Google Fonts:
`https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;700;800&family=IBM+Plex+Mono:wght@500&display=swap`

**Spacing and layout.** Use the 4px scale (`space-1` to `space-12`). The phone gutter is `space-4`. Every tap target is at least `space-12` (48px) tall. Patient screens are a single column with one primary button pinned to the bottom. The provider panel is a dense table first, detail second.

**Shape.** Cards use `radius-md` and a 1px `line` border, no shadow. Buttons and status signals are pills (`radius-pill`). Only bottom sheets get `radius-lg` and `shadow-sheet`.

**Imagery.** No stock photos of fit people. The only human figure in Rise is the patient's own movement, drawn as a cyanotype trace: a `trace` hip path over faint `tint` frames. Illustrations are flat Prussian-blue cut shapes (chair, phone, arc) in `brand` and `tint`.

**Charts.** The patient's line is `brand`; their age- and sex-matched reference band is `tint`; gridlines are `line`. Always label the latest point with its value. Never plot more than the patient's own data and one reference band.

**Motion.** One motion only: during capture, the hip path draws itself in `trace` as each stand is counted. Everything else is still. Respect `prefers-reduced-motion` by showing the finished trace.

**Focus and states.** Every interactive element shows a 3px solid `focus` ring with 2px offset. Pressed primary buttons use `brand-strong`. Disabled controls drop to `ink-muted` text on `tint`, with the reason written next to them.

## Iconography

No icon set has been chosen yet. Until one is, use only the three status marks (circle, triangle, square) and simple line glyphs drawn at 2px stroke in `ink` or `brand`. When choosing a set, pick one with a 2px stroke and rounded joins, and never use icons without a word beside them on patient screens.

## Accessibility rules

- Contrast: every text token passes 4.5:1 on `paper`, `paper-raised` and `tint` in both themes; `line-strong`, `trace` and `focus` pass 3:1.
- Never use color alone: status has a mark and a word; charts label values directly.
- Capture screens speak each instruction aloud as well as showing it, and count stands out loud.
- Support Dynamic Type up to 200% without truncating results.

# Screens and flows

The first build covers two surfaces: the patient app (phone) and the provider panel (web). Build them in this order.

## Patient app

**1. Welcome and consent.** What Rise checks, how long it takes (3 minutes a month), who sees the results (the patient and their care team). One `Button` primary: "Set up my first check".

**2. Setup (once): risk questions.** One question per screen with `IntakeQuestion`, about 2 minutes in total:
1. Age and sex
2. If a woman: have you gone through menopause?
3. Which GLP-1, what dose, and when did you start?
4. Weight now, and weight when you started
5. How active are you in a typical week? (choices, not minutes)
6. Have you fallen in the past year?
7. Any knee, hip or back pain that makes standing up hard?
8. What do you want your strength for? (free text, used in reports: "keep up with my grandkids")
9. Provider connection code

The answers place the patient in a risk tier (draft rules, to be set with clinical advisors):

| Tier | Draft criteria | Check every | Flag sensitivity |
|---|---|---|---|
| Higher | Woman past menopause, or age 65+, or a fall in the past year, or losing weight fast | 2 weeks | Watch at a drop of 1 from baseline; Check in after one Watch |
| Standard | Everyone else | 4 weeks | Rules below |

Then the chair check ("Use a firm chair without arms, about knee height") and phone setup: propped at hip height, 2 to 3 steps away, side view.

**3. Monthly check.**
1. Two readiness questions (sleep, pain or illness today).
2. Body scan (licensed from a phone body-scan provider; not built in-house).
3. Camera check with `CameraCheck`: lens smudge, too close, too far, side view, light, phone steady. One fix at a time, spoken and written; recording can't start until all pass.
4. Sit-to-stand capture with `CaptureFrame`: spoken countdown, 30-second timer, stands counted aloud, hip path drawn in `trace`.
5. Rise rejects a capture it can't measure and says how to fix it.

**4. Result (personalized).** In this order: `StatusSignal`, one `display-xl` verdict sentence using the patient's name, the stands count in `data-xl` with change since their own baseline, `RiseTrace` chart, then `NextStepCard` with an action matched to their risk tier and limits (for example, chair-based moves for knee pain) and tied to their goal from setup. Body-scan numbers sit below in a collapsed "Body scan" section.

**5. History.** Every past check as a row: date, stands, state. Tapping a row opens that result.

**6. Reminder.** One notification a month: "Your muscle check is due. It takes 3 minutes."

## Provider panel

**1. Check-in list (home).** Patients in Check in state first, then Watch; within each, higher-risk tier first. Each `ProviderRow` shows name, age and sex, risk tier, state, stands with trend sparkline, percentile for age and sex, last check date. Steady patients collapse into one line: "41 patients steady".

**2. Patient detail (provider report).** Risk tier and the setup answers behind it, the patient's goal, all checks over time, reference band, capture confidence per check, readiness answers, body-scan values, the actions the patient was given and whether the next check improved.

**3. Record export.** Each check as structured fields (date, reps, state, percentile, lean mass, method, confidence), ready for the health record.

## Example data for prototypes

Use this marked example everywhere so screens stay consistent:

| Check | Stands in 30 s | State |
|---|---|---|
| Aug 1 | 14 | Steady |
| Sep 1 | 13 | Steady |
| Oct 1 | 11 | Watch |

*Example patient: woman, 62, on semaglutide since June. For women 60 to 64, the CDC STEADI norm treats fewer than 12 stands as below average. Thresholds are draft and must be set with clinical advisors.*

## Draft state rules

- **Steady:** stands at or above last check, or down 1 with no readiness flag.
- **Watch:** down 2 or more from baseline, or newly below the age and sex norm. Patient gets a nutrition and strength action, retest in 4 weeks.
- **Check in:** Watch for two checks in a row, or down 4 or more from baseline. Provider is flagged.

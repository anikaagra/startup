# Product principles

These are the rules every screen and feature must follow. Each one comes from the customer-discovery interviews in the team tracker. When a design decision is unclear, check it against this list.

## 1. Every result leads to an action

A measurement that changes nothing gets ignored. Muscle ultrasound never became routine because no clinical decision changed after the scan (Sarwal). The ultrasound engineer interviewed said the same: "No clear clinical action. If a result doesn't change management, clinicians won't spend time on it."

**Rule:** no result screen, report or provider row ships without a next step and a retest date. If a design shows a number without saying what to do about it, it is unfinished.

## 2. Function first, size second

Phillips, Dubin and Sarwal all ranked function first. Phillips would track strength over muscle size; Dubin uses grip and sit-to-stand because they take about a minute; Sarwal noted the 30-second sit-to-stand already predicts falls.

**Rule:** the sit-to-stand result is the headline on every result screen. Body-scan numbers (lean mass, body fat) support it and sit below it.

## 3. Show change, not snapshots

What matters is the trend for this person, compared with their own baseline and with people their age and sex (Sarwal: "adjusted for age"). The engineer's gap list: "Longitudinal comparability is poor."

**Rule:** every number is shown with its change since last check and since the first check. Reference ranges are always age- and sex-matched and their source is named on the provider side (for example, CDC STEADI 30-Second Chair Stand norms).

## 4. Consistency is the product

Measurement error must be smaller than the change you want to detect (engineer). Granger and Phillips both said results depend on doing the test the same way each time.

**Rule:** the capture flow controls the setup every time: same chair height check, same phone position, same distance, same instructions read aloud. Before recording, Rise checks the camera itself and fixes problems in plain words, one at a time:

| Check | What Rise detects | What the patient hears and sees |
|---|---|---|
| Lens | Smudge or blur on the camera | "Wipe your camera lens with a soft cloth." |
| Too close | Head, feet or chair cut off | "Move the phone back one step." |
| Too far | Body too small to track joints | "Move the phone one step closer." |
| Angle | Not a side view | "Turn your chair so your side faces the phone." |
| Light | Too dark or strong backlight | "Turn on a light, or move away from the window." |
| Steady | Phone moving | "Prop your phone against something steady." |

Recording only starts when every check passes. Rise also rejects a finished capture it cannot measure and says why ("Your knees were out of frame. Move the phone back one step.").

## 5. Effort is part of the measurement

Function tests "depend on effort and cooperation" (engineer). A tired or distracted month looks like decline.

**Rule:** before every check, ask two quick questions (sleep, pain or illness today). Results with a flagged condition are marked and never trigger a provider flag on their own.

## 6. Give providers less, not more

Most GLP-1 prescribers are primary care doctors with no time; fewer than 10% of providers treating obesity do any body composition assessment (Dubin). Anything "over a few minutes, or needing a separate device or login, struggles" (engineer).

**Rule:** the provider view opens on a short list of patients who need a check-in, sorted by urgency. Everyone else is summarized in one line. Results go into the record as structured, trackable data, not a PDF to read (Sarwal).

## 7. Simple for patients, scientific for providers

Sarwal: "Scientific for providers. Simplified for patients, recommendations (Fitbit)."

**Rule:** patients see a traffic-light state, one sentence and one action. Providers see the raw values, the reference band, the method and the confidence of each capture.

## 8. Never diagnose

Measuring and tracking keeps the regulatory path simpler; diagnosing does not (engineer: AI measurement tools need clearance and validation data).

**Rule:** patient copy describes change and suggests talking to the care team. Only providers see words like "below average for age". Have a regulatory advisor review flagging logic before launch.

## 9. Earn trust with validation

Doctors trust "validation, published" (Sarwal). The engineer flagged that validation in older adults and people with obesity is missing everywhere.

**Rule:** the provider view shows how each measure was validated and its known error, and links to the evidence. Until the phone sit-to-stand is validated against an in-person test, label it "Pilot measure".

## 10. Built for 50+

The high-risk group is older women losing a lot of weight quickly (Dubin).

**Rule:** large type (`body-lg` minimum), 48px targets, spoken instructions, no gestures that need speed or precision, and every screen usable one-handed while holding the phone steady.

## 11. Know each patient's risk from the start

Risk depends on the patient: older women losing a lot of weight are high risk; young men with good muscle are low risk (Dubin).

**Rule:** setup asks a short set of risk questions (see `screens.md`) and places each patient in a risk tier. The tier sets how often they check, how sensitive the Watch and Check-in rules are, and what their provider sees first. Re-ask the questions every 3 months or when the dose changes.

## 12. Personalize every report to its reader

The same check means different things to a 67-year-old woman on her first month of semaglutide and to her doctor.

**Rule:** reports are written for the person reading them.
- **Patient report:** their name, their own goal from setup ("keep up with my grandkids"), change since their own baseline, one action matched to their risk tier and what they said they can do (for example, chair-based strength moves for someone with knee pain), and the retest date.
- **Provider report:** risk tier and the answers behind it, raw values, age and sex percentile, trend, capture confidence, readiness flags, what the patient was told to do, and whether it worked.

## What Rise does not do (yet)

- No ultrasound. Dubin and Sarwal both said it adds no clinical value in routine care today.
- No muscle-quality score. Phillips showed image brightness is unreliable while the fat layer is shrinking.
- No lab values. Sarwal suggested kidney, liver and electrolyte data; that is a later integration, not version one.

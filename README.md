# Track C1 — Safe Access to Patient Records

Built to match `BUILD_CONTRACT.md`: SQLite schema, the `decide()` access
engine, a hash-chained audit log, an abuse detector, and every screen
needed to run a full demo without a terminal (except for the one scene
that deliberately needs one — editing the database by hand).

Since the initial build, the prototype was reviewed by someone with real
hospital operations experience, who correctly identified two ordinary
situations — a colleague covering a shift, and a cross-department
referral — that had no legitimate route to access at all and were being
forced through the emergency override. Both are now handled properly;
see "Features added after review" below.

> **If you downloaded an earlier version of this zip**: an even earlier
> build used `better-sqlite3`, which needs a C++ compiler to install on
> Windows and failed without Visual Studio build tools. This version
> uses Node's own built-in SQLite instead — nothing to compile, nothing
> extra to install, on any OS.

## What's included

- **backend/** — Node.js + Express, using Node's own built-in `node:sqlite`
  module (real `.db` file, no server install, no native compilation, no
  build tools required on any OS), the `decide()` engine, hash-chain
  logger and verifier, abuse detector, and the seed script with the
  three planted abuse cases.
- **frontend/** — React + Vite + Tailwind. Staff picker (simulated
  session), ward patient list, record view with redaction, break-glass,
  shift covers and referrals, supervisor alerts dashboard, audit browser
  with chain verification, and a "demo clock" to simulate off-shift time
  without waiting real hours.

Everything in here has been run and tested, not just written: the seed
data loads, every API route has been hit directly, the hash chain has
been tampered with and caught, and `npm run build` completes cleanly.

## One deliberate departure from the contract, documented up front

The contract writes `decide()` in Python-style type hints. The whole
system here is built in Node/JavaScript instead. The five checks, the
reason codes, the `Decision` shape (`outcome`, `reason`, `categories`),
and their order are followed exactly — only the implementation language
differs.

Two categories of addition beyond the contract's literal schema:

1. An `alerts` table — the contract's schema has no table that could
   hold `POST /alerts/{id}/close` state (reviewer, outcome, open/closed),
   so a minimal one was added.
2. `shift_covers` and `consult_referrals` tables — added after reviewer
   feedback (see below), documented in a comment at the top of
   `schema.sql`.

## Features added after review

**Shift substitution.** A colleague covering someone's shift is common
and legitimate in a short-staffed hospital, but the first version of
this prototype forced it through the emergency override — which
misrepresented an ordinary handover as an incident. The fix creates a
*real* row in the existing `shifts` and `assignments` tables for the
covering staff member, and copies the absent colleague's currently open
`encounters` for that ward to her. She is then evaluated by the exact
same five checks as anyone else on duty — no new access path was added
to `decide()`.

**Cross-department consult (referral).** A doctor referring a patient to
a specialist who has never treated them — Family Medicine to Obstetrics
& Gynaecology, for example — previously had no legitimate route to
access at all. `consult_referrals` is a second, explicit, time-boxed
source of "this access is legitimate," alongside `encounters`. It can
excuse a ward mismatch or a missing encounter (checks 3 and 4 in
`decide()`) but never an inactive account, an absent shift, or a
disallowed action.

**Emergency override categories.** Break-glass, reviewed in isolation,
looked like a blank text box anyone could type their way past. The
mechanism is unchanged — access is still instant and never blocked — but
requesting staff now choose "Code Blue" or "Other" first. A Code Blue
selection is logged and flagged high-severity for immediate review.

## Prerequisites

- **Node.js 22.5 or later** (check with `node -v`). This matters more
  than usual: the backend uses Node's own built-in SQLite module
  (`node:sqlite`), which only exists from 22.5 onward. Get the latest
  LTS from https://nodejs.org if you're below that.
- A terminal. Nothing else — no Docker, no separate database server, no
  C++ build tools, no Visual Studio.

## Step-by-step setup

### 1. Clone or extract

You'll end up with `trackc1/` containing `backend/` and `frontend/`.

### 2. Backend

```bash
cd trackc1/backend
npm install
cp .env.example .env
npm run init-db
npm run seed
npm run dev
```

`npm run init-db` deletes any existing `data.db` and rebuilds every
table from `db/schema.sql`, including `shift_covers` and
`consult_referrals`. `npm run seed` fills it with wards, staff, shifts,
patients, and the three planted abuse cases (documented in a comment at
the top of `seed.js`). Leave `npm run dev` running — it should print
`Track C1 backend running on port 4000`.

**Re-run `init-db` and `seed` before every demo recording** to reset to
a clean state — otherwise leftover shift covers, referrals, and
overrides from testing will clutter the alerts dashboard on camera.

### 3. Frontend

Open a **second terminal**, keep the backend running in the first:

```bash
cd trackc1/frontend
npm install
npm run dev
```

Open the printed URL, normally `http://localhost:5173`.

### 4. Log in

There's no real authentication — sessions are simulated. Pick a staff
member from the list on first load:

| Staff | Role | Notes |
|---|---|---|
| Dr. Amaka Obi | doctor | assigned to Ward B |
| Nurse Tolu Adeyemi | nurse | assigned to Ward A, planted case 2 |
| Clerk Ifeoma Nwosu | clerk | assigned to Ward A, planted case 1 |
| Dr. Musa Bello | doctor | assigned to Ward C, also a seeded patient |
| David Okonkwo | clerk | **inactive** — planted case 3 |
| System Admin | admin | can view alerts and the audit browser |

## Running the demo

**Scene 1 — normal access.** Log in as Nurse Adeyemi, open Chinedu
Okafor (Ward A). Access is allowed; the explanation banner says why.

**Scene 2 — same person, off shift.** Use the amber "Demo clock" bar at
the top of the screen, click "+24h", then reopen the same patient.
Access is denied with reason `off_shift`. Click "Reset to live"
afterward.

**Scene 3 — shift substitution.** Log in as Clerk Ifeoma Nwosu, try
opening Ngozi Umeh (Ward B) — denied, `ward_mismatch`. Click "I'm
covering a colleague's shift," pick Dr. Amaka Obi, pick Ward B, confirm.
Open Ngozi Umeh again — now allowed, through a real shift and
assignment, not a special case.

**Scene 4 — cross-department referral.** Log in as Dr. Musa Bello, open
Grace Nnamdi (he already has a relationship with her). Click "Refer to
specialist," send her to Ward B for 48 hours. Switch to Dr. Amaka Obi,
open Grace Nnamdi — now allowed, with a banner naming who referred her
and when access expires.

**Scene 5 — Code Blue override.** Try opening a patient with no
relationship. Click "Use emergency override," choose "Critical medical
emergency (Code Blue)," see the warning, confirm — access is instant.
Check Alerts: it's flagged high severity and prefixed "CODE BLUE."

**Scene 6 — tamper the log in front of judges.** Open `backend/data.db`
with any SQLite browser (e.g. "DB Browser for SQLite"). Edit the
`reason` or `action` field on any row in `audit_log`, save. Go to the
Audit tab, click "Verify chain" — it names the exact row that broke.

**Scene 7 — abuse dashboard.** Go to Alerts as System Admin. All three
planted cases are visible, ranked by severity, alongside anything
created during the earlier scenes — shift covers in amber, referrals in
green, break-glass and Code Blue in amber/red.

## Reason codes

| Code | Meaning |
|---|---|
| `staff_inactive` | Staff row doesn't exist or is inactive |
| `off_shift` | No shift covers the current time |
| `ward_mismatch` | Patient isn't on a ward the staff is assigned to (and no active referral excuses it) |
| `no_treatment_relationship` | No encounter links this staff/patient pair (and no active referral excuses it) |
| `action_not_permitted` | Role doesn't allow this action |
| `on_duty_treatment_relationship` | Success — on shift, on the right ward, with a direct encounter |
| `referral_active` | Success — access granted through an active specialist referral |
| `break_glass` | Emergency override used, with a note |
| `break_glass_missing_note` | Override used without a note — access still granted, row flagged |

## API routes

| Route | Purpose |
|---|---|
| `GET /patients` | List all patients (for the ward view) |
| `GET /patients/:id?staff_id=&now=` | Attempt to view a record; runs `decide()` |
| `POST /break-glass` | `{ staff_id, patient_id, note, category }` — emergency override |
| `POST /shift-covers` | `{ covering_staff_id, absent_staff_id, ward_id }` — set up a shift cover |
| `POST /consult-referrals` | `{ patient_id, referring_staff_id, target_ward_id, note, hours }` — create a referral |
| `GET /consult-referrals?patient_id=` | List referrals for a patient |
| `GET /audit?staff_id=&patient_id=` | Browse the audit log |
| `GET /verify` | Walk the hash chain, report the first broken row if any |
| `GET /alerts?status=` | Runs the detector, returns alerts |
| `POST /alerts/:id/close` | `{ reviewer_id, outcome }` — close an alert |
| `GET /staff`, `GET /wards` | Listing endpoints for UI pickers |

## Project structure

trackc1/
backend/
db/
schema.sql Contract schema + alerts, shift_covers, consult_referrals
init.js Creates data.db from schema.sql
seed.js Demo data + the three planted abuse cases
src/
db.js node:sqlite connection (built into Node)
decide.js The access engine — five checks + referral logic
hashChain.js Append + verify the tamper-evident log
detector.js Pattern-based abuse detection -> alerts
index.js Express routes
.env.example
package.json
frontend/
src/
context.jsx Simulated session + demo clock state
pages/
StaffSelect.jsx "Login" (staff picker)
WardView.jsx Patient list across all wards
PatientRecord.jsx Record view, redaction, break-glass, covers, referrals
Alerts.jsx Supervisor alert dashboard
AuditBrowser.jsx Log browser + chain verification
components/
Navbar.jsx
TimeMachine.jsx Demo clock control
package.json
README.md


## Honest limitations

- The shift roster, and now the shift-cover and referral records, are
  trusted input from whoever is logged in. A covering nurse or referring
  doctor is not verified beyond holding an active staff account — both
  actions are fully logged and surfaced on the alerts dashboard, but
  nothing currently blocks a false claim at the moment it's made.
- A referral grants access to an entire target ward, not one named
  specialist — appropriate for a department consult, coarser than
  referring to one individual.
- The hash chain proves tampering happened — it does not prevent it. An
  attacker with write access to the database could rewrite the entire
  chain. Real protection needs hashes anchored off-box.
- Break-glass remains abusable by design, now with a required category.
  This is a deliberate trade of prevention for detection and visibility,
  only safe if the alerts it generates are actually reviewed.
- The high-volume detector will still flag legitimate but informal
  situations — a clerk briefly helping across wards during a shortage,
  without a formal cover being recorded, looks identical to probing.
- There's no real authentication. Sessions are simulated by picking a
  name from a list. This is an access-control prototype, not an
  identity system.

## Offline answer (from the contract)

A ward device would hold a signed, read-only cache of currently admitted
patients on that ward, plus a local append-only log that merges into the
main chain on reconnect. Under total outage: sealed pre-printed
break-glass envelopes with paper sign-out, reconciled against the
digital log the next morning. Not built — stating this is what the
contract's own rules ask for.

## Troubleshooting

- **`No such built-in module: node:sqlite` or similar** — your Node
  version is below 22.5. Run `node -v`, install the latest LTS from
  https://nodejs.org, re-run `npm install`.
- **You'll see an `ExperimentalWarning: SQLite is an experimental
  feature` line on every backend start** — expected and harmless.
- **Frontend shows a network error** — make sure the backend terminal is
  still running on port 4000.
- **"Access denied" for everyone** — check the demo clock isn't stuck on
  an old override; click "Reset to live."
- **Alerts list looks empty** — alerts are generated the first time
  `/alerts` is called after new audit rows exist; refresh the Alerts
  page once.
- **Shift-cover or referral fails with an error** — the absent colleague
  needs an active shift on the target ward right now (or at whatever
  time the demo clock is set to); the referring staff member needs
  current, legitimate access to the patient before they can refer them
# Track C1 — Safe Access to Patient Records

Built to match `BUILD_CONTRACT.md` exactly: SQLite schema, the `decide()`
access engine, hash-chained audit log, abuse detector, and every screen
needed to run the five-scene demo without a terminal (except for the one
scene that deliberately needs one — editing the database by hand).

> **If you downloaded an earlier version of this zip**: that build used
> `better-sqlite3`, which needs a C++ compiler to install on Windows and
> failed without Visual Studio build tools. This version uses Node's own
> built-in SQLite instead — nothing to compile, nothing extra to
> install, on any OS. Just re-extract this zip over the old one.

## What's included

- **backend/** — Node.js + Express, using Node's own built-in `node:sqlite`
  module (real `.db` file, no server install, no native compilation, no
  build tools required on any OS), the `decide()` engine, hash-chain
  logger and verifier, abuse detector, and the seed script with the
  three planted abuse cases.
- **frontend/** — React + Vite + Tailwind. Staff picker (simulated
  session), ward patient list, record view with redaction and
  break-glass, supervisor alerts dashboard, audit browser with chain
  verification, and a "demo clock" to simulate off-shift time without
  waiting real hours.

Everything in here has been run and tested, not just written: the seed
data loads, every API route was hit with curl, the hash chain was
tampered with and caught, and `npm run build` completes cleanly.

## One deliberate departure from the contract, documented up front

The contract writes `decide()` in Python-style type hints. The whole
system here is built in Node/JavaScript instead, matching an existing
codebase decision, not the contract's literal syntax. The five checks,
the reason codes, the `Decision` shape (`outcome`, `reason`,
`categories`), and their order are followed exactly — only the
implementation language differs. Say this plainly if a teammate or judge
asks why there's no Python file.

One addition beyond the contract's literal schema: an `alerts` table.
The contract's schema has no table that could hold `POST
/alerts/{id}/close` state (reviewer, outcome, open/closed), so a minimal
one was added. It's called out in a comment at the top of `schema.sql`.

## Prerequisites

- **Node.js 22.5 or later** (check with `node -v`). This matters more
  than usual here: the backend uses Node's own built-in SQLite module
  (`node:sqlite`), which only exists from 22.5 onward, so this isn't a
  soft recommendation. Get the latest LTS from https://nodejs.org if
  you're below that.
- A terminal. Nothing else — no Docker, no separate database server, no
  C++ build tools, no Visual Studio.

## Step-by-step setup

### 1. Extract the zip

You'll get `trackc1/` with `backend/` and `frontend/` inside.

### 2. Backend

```bash
cd trackc1/backend
npm install
cp .env.example .env
npm run init-db
npm run seed
npm run dev
```

`npm run init-db` creates `data.db` from `db/schema.sql`. `npm run seed`
fills it with wards, staff, shifts, patients, and the three planted
abuse cases (documented in a comment at the top of `seed.js`). Leave
`npm run dev` running — it should print `Track C1 backend running on
port 4000`.

### 3. Frontend

Open a **second terminal**, keep the backend running in the first:

```bash
cd trackc1/frontend
npm install
npm run dev
```

Open the printed URL, normally `http://localhost:5173`.

### 4. Log in

There's no real authentication — sessions are simulated, exactly as the
contract specifies. Pick a staff member from the list on first load:

| Staff | Role | Notes |
|---|---|---|
| Dr. Amaka Obi | doctor | assigned to Ward B |
| Nurse Tolu Adeyemi | nurse | assigned to Ward A, planted case 2 |
| Clerk Ifeoma Nwosu | clerk | assigned to Ward A, planted case 1 |
| Dr. Musa Bello | doctor | assigned to Ward C, also a seeded patient |
| David Okonkwo | clerk | **inactive** — planted case 3 |
| System Admin | admin | can view alerts and the audit browser |

## Running the five-scene demo

**Scene 1 — normal access.** Log in as Nurse Adeyemi, open Chinedu
Okafor (Ward A). Access is allowed; the explanation banner says why.

**Scene 2 — same person, off shift.** Use the amber "Demo clock" bar at
the top of the screen, click "+24h", then reopen the same patient.
Access is denied with reason `off_shift`. Click "Reset to live" to go
back to normal time afterward.

**Scene 3 — break-glass.** Log in as Dr. Amaka Obi, try to open Grace
Nnamdi (Ward C, no relationship, wrong ward). You'll be denied; click
"Use emergency override," give a reason, and you're in immediately. Go
to the Alerts tab (log in as System Admin, or just navigate there) — the
alert is already sitting there.

**Scene 4 — tamper the log in front of judges.** Open `backend/data.db`
with any SQLite browser (e.g. "DB Browser for SQLite", or `sqlite3
data.db` on the command line). Edit the `reason` or `action` field on
any row in `audit_log`. Go to the Audit tab, click "Verify chain" — it
names the exact row that broke.

**Scene 5 — abuse dashboard.** Go to Alerts as System Admin. Clerk
Ifeoma Nwosu's `high_volume_no_relationship` alert is at the top,
alongside the planted break-glass and inactive-staff alerts.

## Reason codes (must match the contract exactly)

| Code | Meaning |
|---|---|
| `staff_inactive` | Staff row doesn't exist or is inactive |
| `off_shift` | No shift covers the current time |
| `ward_mismatch` | Patient isn't on a ward the staff is assigned to |
| `no_treatment_relationship` | No encounter links this staff/patient pair |
| `action_not_permitted` | Role doesn't allow this action |
| `on_duty_treatment_relationship` | Success — all checks passed |
| `break_glass` | Emergency override used, with a note |
| `break_glass_missing_note` | Override used without a note — access still granted, row flagged |

## Project structure

```
trackc1/
  backend/
    db/
      schema.sql        Exact contract schema + the alerts table addition
      init.js            Creates data.db from schema.sql
    seed.js               Demo data + the three planted abuse cases
    src/
      db.js               node:sqlite connection (built into Node)
      decide.js            The access engine — five ordered checks
      hashChain.js          Append + verify the tamper-evident log
      detector.js            Pattern-based abuse detection -> alerts
      index.js              Express routes
    .env.example
    package.json
  frontend/
    src/
      context.jsx          Simulated session + demo clock state
      pages/
        StaffSelect.jsx     "Login" (staff picker)
        WardView.jsx         Patient list across all wards
        PatientRecord.jsx     Record view, redaction, break-glass
        Alerts.jsx             Supervisor alert dashboard
        AuditBrowser.jsx        Log browser + chain verification
      components/
        Navbar.jsx
        TimeMachine.jsx        Demo clock control
    package.json
  README.md
```

## Limitations (from the contract — say these out loud in the demo)

- The shift roster is trusted input. A corrupted roster breaks the whole
  model; a real deployment needs it fed from a signed HR system.
- The hash chain proves tampering happened — it does not prevent it. An
  attacker with write access to the database could rewrite the entire
  chain. Real protection needs hashes anchored off-box (a periodic digest
  sent to a second machine, or printed and signed daily).
- Break-glass is abusable by design. Prevention was traded for detection,
  because a login screen must never stand between a doctor and a dying
  patient. That trade only holds if someone actually reads the alerts.
- The detector will flag legitimate cross-ward cover as suspicious. The
  false-positive rate hasn't been measured, and in a short-staffed
  hospital, cross-ward cover is normal — so it's probably high.
- There's no real authentication. Sessions are simulated by picking a
  name from a list. This is an access-control prototype, not an identity
  system.

## Offline answer (from the contract)

A ward device would hold a signed, read-only cache of currently admitted
patients on that ward, plus a local append-only log that merges into the
main chain on reconnect. Under total outage: sealed pre-printed
break-glass envelopes with paper sign-out, reconciled against the
digital log the next morning. Not built here — this prototype focuses
its time on the access engine, the log, and the detector — but stating
this clearly is what the contract's own rules ask for.

## Troubleshooting

- **`No such built-in module: node:sqlite` or similar** — your Node
  version is below 22.5. Run `node -v` to check, then install the
  latest LTS from https://nodejs.org and re-run `npm install`.
- **You'll see an `ExperimentalWarning: SQLite is an experimental
  feature` line on every backend start** — this is expected and
  harmless. It's Node telling you `node:sqlite` is newer than most
  built-ins, not an error.
- **Frontend shows a network error** — make sure the backend terminal is
  still running on port 4000.
- **"Access denied" for everyone** — check the demo clock isn't stuck on
  an old override; click "Reset to live."
- **Alerts list looks empty** — alerts are generated the first time
  `/alerts` is called after new audit rows exist; refresh the Alerts
  page once.

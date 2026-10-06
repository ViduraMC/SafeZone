# SafeZone: Smart Disaster Early-Warning & Emergency Coordination (Sri Lanka)

SE3070 Case Studies in Software Engineering, **Assignment 02**: implementation of the
*SafeZone* design received from **Group 02** (Assignment 01), with the improvements proposed
in our critique applied.

SafeZone is a single, role-based **mobile app**. Citizens, community volunteers, duty
officers, DMC officers, district officers, rescue teams, DMC officials and donor
organisations all use it. Our group has five members, so the design was refined into five
business use cases, one per member:

| # | Use case | Primary actor(s) | Owner | Code | Tests |
|---|----------|------------------|-------|------|-------|
| UC01 | Issue Hazard Warning | DMC Officer | S.A.V.M. Chandrasekara | `src/modules/alerts` | `tests/alerts` |
| UC02 | Submit & Verify Hazard Report | Citizen / Volunteer, Duty Officer | H.D. Cabraal | `src/modules/reports` | `tests/reports` |
| UC03 | Coordinate Emergency Shelters | District Officer | M.M.Y.K. Bandara | `src/modules/shelters` | `tests/shelters` |
| UC04 | Dispatch Rescue Teams & Relief Resources | District Officer, Rescue Team | N.A. Jeewaraja | `src/modules/dispatch` | `tests/dispatch` |
| UC05 | Generate Disaster Response Reports | DMC Official, Donor Organisation | L.D.B. Madigasekara | `src/modules/analytics` | `tests/analytics` |

The matching screens live in `src/ui/screens/<warnings | reports | shelters | dispatch | analytics>`.
The shared kernel in `src/core` (geography, hazard types, users and roles, organisations,
offline sync, notifications) supports all five use cases.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 and open in a phone-sized window (or browser dev-tools device mode)
npm test             # 210 unit + component tests
npm run coverage     # coverage report (HTML in ./coverage)
npm run build        # type-check + production build
```

Node 20+ is required. No backend is needed: the app runs in the browser with an in-memory
local store. Realistic demo data (Kelani basin floods, Central Highlands landslides and the
completed *Southern Monsoon Floods - May 2026* event) is seeded through the real services on
start-up.

### Demo personas and simulation controls

Login is out of scope (the brief excludes login, logout and privilege management). Instead,
the **Hub** tab has a persona switcher. You can also open the app directly as a persona with
`?persona=<id>`:

| Persona | Role | Starts at |
|---------|------|-----------|
| `USR-CITIZEN` Nimali Perera | Citizen (Colombo) | Home (critical alert) |
| `USR-VOLUNTEER` Amith Perera | Citizen + Community Volunteer | Home |
| `USR-DUTY` Kasun Jayasuriya | Duty Officer | Review queue |
| `USR-DMC` Ruwan Wijesinghe | DMC Officer | Hazard warning dashboard |
| `USR-DISTRICT` Pradeep Silva | District Officer (Colombo) | Coordination overview (UC03, UC04) |
| `USR-RESCUE` Lt. Sanjeewa Bandara | Rescue Team member (SL Navy unit 1) | Rescue status update |
| `USR-OFFICIAL` Dr. Chamari Fernando | DMC Official | Disaster response reports |
| `USR-DONOR` Dilani Gunawardena | Donor Organisation (Red Cross) | Disaster response reports |

The FAQ allows hardware and external services to be simulated, so the Hub (and the
Online/Offline pill in every header) can switch:
**data network** (offline capture and sync, push failure), **SMS gateway** (alert fallback and
queueing), **device GPS** (manual location entry) and a **server sync failure** (UC03 E4).

## Git workflow

* `main` holds only reviewed, release-ready code. Nothing is committed to it directly.
* `dev` is the integration branch that every feature is merged into.
* Work happens on short-lived branches named by purpose, for example `feat/hazard-warning`,
  `fix/inbox-message-order`, `docs/design-traceability` or `chore/project-setup`. Each one is
  merged into `dev` with a merge commit (`--no-ff`) so the history shows each piece of work.
* `dev` is merged into `main` only after the whole group has reviewed it and the tests pass.
* Commit messages follow the Conventional Commits style (`feat:`, `fix:`, `test:`, `docs:`,
  `refactor:`, `chore:`).

## Architecture

```
src/
├── core/                 shared kernel (no UI, no framework)
│   ├── shared/           Repository, EventBus, Clock, IdGenerator, errors, FieldErrors
│   ├── geo/              District, RiverBasin, GeoDirectory (25 districts, 8 basins)
│   ├── hazard/           HazardType registry (configurable), SeverityLevel
│   ├── events/           DisasterEvent
│   ├── users/            UserAccount + Role composition, UserDirectory
│   ├── organisations/    ResourceOwner, OrganisationDirectory
│   ├── notifications/    in-app Inbox
│   └── sync/             ConnectivityMonitor, SyncService (offline outbox), FieldUpdateRecorder
├── modules/              one folder per use case, layered
│   ├── alerts/           UC01  domain / channels / application
│   ├── reports/          UC02  domain / application
│   ├── shelters/         UC03  domain / application
│   ├── dispatch/         UC04  domain / application
│   └── analytics/        UC05  domain / application / infrastructure
├── app/                  composition root (dependency injection) + demo data
└── ui/                   React presentation layer (screens per role)
```

* **Domain layer**: entities and value objects that enforce business rules, such as
  `HazardAlert`, `GroundReport`, `Shelter`, `RescueTeam` and `ReportingPeriod`.
* **Application layer**: one service per use-case responsibility, such as `AlertService`,
  `ReportSubmissionService`, `ShelterCoordinationService`, `RescueDispatchService` and
  `DisasterReportGenerator`.
  Services depend only on interfaces (ports).
* **Infrastructure / adapters**: in-memory repositories plus simulated SMS, push, GPS and
  server gateways. All of them sit behind interfaces, so a real backend can replace them
  without changing the services.
* **Composition root** (`src/app/container.ts`): the only place where concrete classes are chosen.

### Design patterns used

| Pattern | Where | Why |
|---------|-------|-----|
| Strategy | `ChannelSelectionPolicy`, `TargetArea`, `ReportSectionBuilder`, `ReportAccessPolicy`, `ReportExporter` | Swap behaviour (channels, targeting, report sections, access, export formats) without editing callers |
| Repository | `Repository<T>` / `InMemoryRepository` | Persistence behind an abstraction |
| Observer | `EventBus` (+ UI refresh) | Modules react to each other without direct coupling |
| State machine | `ReportStatus` transitions, `RescueTeamStatus` transitions (mission outcome required to finish) | Illegal status changes are impossible |
| Facade / Application service | `AlertService`, `ReportVerificationService`, … | One entry point per use case for the UI |
| Adapter | `analytics/infrastructure/RepositoryDataSources`, `SmsGateway`, `LocationProvider`, `RemoteSyncGateway` | Isolate other modules and external systems |
| Dependency Injection | `createSafeZone()` | Testability, Dependency Inversion |
| Factory | `createTargetArea`, `HazardAlert.draft`, `GroundReport.submit` | Valid object creation in one place |

See [`docs/DESIGN_CHANGES.md`](docs/DESIGN_CHANGES.md) for how every critique point maps to
the code, [`docs/DIAGRAMS.md`](docs/DIAGRAMS.md) for the improved class and sequence diagrams,
and [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md) for the UI flow with screenshots.

## Testing

* **Vitest** + **Testing Library**, with tests in `tests/` mirroring `src/`.
* Each of the five use cases is tested at the domain level (rules and state machines) and the application
  level (services with in-memory adapters). Tests cover positive, negative, edge and
  error/exception flows: every scenario's alternate flows (A1 to A4) and exception flows (E1 to E4).
* Component smoke tests render the real screens for each use case.
* Coverage over `src/core` and `src/modules`: **100% statements / lines / functions, ~98% branches**
  (the threshold is set to 80% in `vite.config.ts`).

```bash
npm run coverage
```

## Regenerating the report screenshots

```bash
npm run build && npx vite preview --port 4173 &
npm run screenshots   # writes docs/screenshots/*.png (uses the pre-installed Chromium)
```

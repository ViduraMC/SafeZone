# Critique → Design change → Implementation traceability

The assignment requires that *"the suggested changes in the report are followed exactly in the
implementation"*. This table links each point of our critique of Group 02's design (see
`SafeZone_SOLID_Critique`) to the changed design element, the code that implements it and the
tests that verify it. Use it as the backbone of the "Proposed changes" section of the report.

The original use cases are **kept**. No use case was replaced; changes only correct defects or
broaden the scope where the critique justifies it.

> **Numbering.** In the *Critique* columns, use case numbers follow Group 02's original design
> (UC01 Issue Hazard Warning, UC02 Submit & Verify Hazard Report, UC03 Coordinate Shelter &
> Relief Resources, UC04 Generate Disaster Response Reports). In our improved design the
> original UC03 became **UC03 Coordinate Emergency Shelters** and **UC04 Dispatch Rescue Teams &
> Relief Resources**, and the original UC04 became **UC05**.

## 0. Use case structure

| # | Critique | Change made | Implemented in |
|---|---|---|---|
| C1 | The original UC03 bundles three independent business processes (shelters, rescue teams, relief supplies) into one 20-step main flow with 8 alternate and exception flows. Shelter allocation and rescue dispatch have different triggers, timings and secondary actors (rescue teams and resource owners only take part in dispatch), so one scenario cannot describe them well. | Split into UC03 Coordinate Emergency Shelters and UC04 Dispatch Rescue Teams & Relief Resources. Both keep the District Officer as primary actor and share the same coordination dashboard and offline sync. The split also gives each of our five members one complete use case. | `src/modules/shelters`, `src/modules/dispatch` |
| C2 | The original UC04 sequence diagram collects "rescue statistics" from `RescueTeam`, but no class or scenario step records what a rescue achieved. | A rescue team finishes a mission by recording the number of people rescued (`RescueTeam.completeMission`). UC05 gains a *Rescue Operations* section (missions, people rescued, average response time, cross-organisation missions). | `dispatch/domain/RescueTeam.ts`, `analytics/application/SectionBuilders.ts` (`RescueOperationsBuilder`) |

## 1. SOLID corrections

| # | Critique (original design) | Principle | Change made | Implemented in | Verified by |
|---|---|---|---|---|---|
| S1 | `HazardAlert` holds data **and** `createWarning()`, `escalate()`, `targetByDistrict()`, `targetByRiverBasin()`, `broadcast()` | SRP | `HazardAlert` keeps data and lifecycle only (`activate`, `escalate`, `resolve`). Delivery moved to `AlertBroadcaster`, targeting to `TargetArea`, orchestration to `AlertService` | `modules/alerts/domain/HazardAlert.ts`, `application/AlertBroadcaster.ts`, `application/AlertService.ts` | `tests/alerts/domain.test.ts`, `AlertService.test.ts` |
| S2 | `AnalysisReport` is a god class (timeline, occupancy, distribution, reach **and** file export) | SRP | Split into `DisasterReportGenerator` (orchestration), one `ReportSectionBuilder` per category, and `ReportExporter` (CSV / JSON) | `modules/analytics/application/*` | `tests/analytics/*` |
| S3 | Entities do device I/O: `Evidence.capturePhoto()`, `captureGPSLocation()`, `GroundReport.writeDescription()` | SRP | `Evidence` and `ReportLocation` are pure data. GPS sits behind the `LocationProvider` port and photo checks in `PhotoValidator`. Capture is a UI concern | `modules/reports/domain/Evidence.ts`, `ReportLocation.ts`, `application/LocationProvider.ts` | `tests/reports/domain.test.ts` |
| S4 | Duplicated behaviour: `DistrictOfficer.registerShelter()` vs `Shelter.register()`, `DutyOfficer.verifyReport()` vs `ReportVerification.verifyCredibility()`, `DMCOfficer.issueAlert()` vs `HazardAlert.createWarning()` | SRP | Actors are plain `UserAccount`s with roles. Each behaviour has exactly one owner: `ShelterCoordinationService.registerShelter`, `ReportVerificationService.verify`, `AlertService.issueWarning` | `modules/*/application/*Service.ts` | service tests |
| S5 | `DeliveryRecord.queuePendingDelivery()`: retry queue hidden inside a record | SRP | `DeliveryRecord` only records attempts (`QUEUED` status, `recordRetrySuccess/Failure`). `AlertBroadcaster.retryQueued()` owns retries and runs automatically when connectivity returns | `alerts/domain/DeliveryRecord.ts`, `AlertBroadcaster.ts`, `app/container.ts` | `AlertService.test.ts` ("queues recipients…") |
| O1 | `HazardType` is a fixed enum (FLOOD, LANDSLIDE, CYCLONE, DROUGHT) despite fast- and slow-onset hazards | OCP | `HazardType` is configuration (`onset`, `defaultSeverity`, `maxValidityHours`) in a `HazardTypeRegistry`. FLASH_FLOOD and TSUNAMI were added with no code change | `core/hazard/HazardType.ts` | `tests/core/geoAndHazards.test.ts`, validator tests (drought vs tsunami validity) |
| O2 | Channel selection hard-wired to severity inside `broadcast()` | OCP | `ChannelSelectionPolicy` strategy; `SeverityBasedChannelPolicy` implements A4 and citizen preferences | `alerts/channels/ChannelSelectionPolicy.ts` | `tests/alerts/channels.test.ts` |
| O3 | Targeting is closed: separate `targetByDistrict()` / `targetByRiverBasin()` | OCP | `TargetArea` interface with `DistrictTarget` and `RiverBasinTarget`. A GPS-radius target would be one new class | `alerts/domain/TargetArea.ts` | `tests/alerts/domain.test.ts` |
| O4 | `NGOArmedForcesOwner` merges two owner types; no Government class | OCP / modelling | A single `ResourceOwner` with an `OwnerType` value (GOVERNMENT, ARMED_FORCES, NGO, PRIVATE_DONOR). All four owners from the case study exist | `core/organisations/ResourceOwner.ts` | relief service tests (filter by owner type) |
| L1 | `AudibleAlertChannel` breaks the `NotificationChannel` contract (local playback is not delivery; extra `triggerEventBackgrounded()`) | LSP | Audible alert is a **presentation mode** (`audibleOverride`) of a push message. Every channel's `send()` now means "reached the device" | `alerts/channels/NotificationChannel.ts`, `PushNotificationChannel.ts` | `channels.test.ts` |
| L2 | `Volunteer extends Citizen` fixes the role at creation | LSP | Role composition: `UserAccount.roles` + optional `VolunteerProfile` | `core/users/UserAccount.ts` | `tests/core/usersAndInbox.test.ts` |
| L3 | `DonorOrganization extends ResourceOwner` also consumes reports | LSP | Donor = `ResourceOwner` (data) + `DONOR_REPRESENTATIVE` user role. Report access goes through `DonorAccessPolicy` | `analytics/application/ReportAccessPolicy.ts` | `generator.test.ts` |
| I1 | `Citizen` bundles `submitReport()` + `receiveAlert()`; `DMCOfficer` bundles `issueAlert()` + `generateReport()` | ISP | Actors no longer carry use-case methods. Narrow ports instead: `UserDirectory`, `VerifiedReportFeed`, `LocationProvider`, `SmsGateway` | `core/users/UserDirectory.ts`, `alerts/application/VerifiedReportFeed.ts` |: |
| I2 | `AnalysisReport` depends on whole `HazardAlert`, `Shelter` and `ReliefSupply` classes | ISP | Read-only fact ports: `AlertHistorySource`, `DeliveryStatisticsSource`, `OccupancyHistorySource`, `DistributionHistorySource` | `analytics/application/DataSources.ts` | `sections.test.ts` (fakes) |
| D1 | No service/repository layer; `HazardAlert` calls `ReportVerification` directly (UC01 seq.); `GroundReport` notifies `DutyOfficer` (UC02 seq.) | DIP | Application services depend on `Repository<T>`, `EventBus` and ports. UC01 reads verified reports through `VerifiedReportFeed` (implemented by UC02). Duty officers are notified by `ReportNotifier` | `core/shared/Repository.ts`, `reports/application/ReportNotifier.ts` | service tests |
| D2 | Report generation queries each entity (UC04 sequence) | DIP | Generator depends on data-source abstractions. Adapters in `analytics/infrastructure` read other modules | `analytics/infrastructure/RepositoryDataSources.ts` | `generator.test.ts` (end-to-end) |
| D3 | Offline sync is a requirement in UC02 E2 and UC03 E1/E4 but has no abstraction | DIP | `ConnectivityMonitor`, `SyncService` outbox, `RemoteSyncGateway`, and pluggable `SyncHandler`s per module | `core/sync/*` (incl. `FieldUpdateRecorder`) | `tests/core/sync.test.ts`, offline tests in UC02/UC03 |

## 2. UML and consistency corrections

| # | Critique | Change | Implemented in |
|---|---|---|---|
| U1 | No `DisasterEvent` class, though UC03 and UC04 start with "select disaster event" | Added `DisasterEvent`. Alerts, rescue assignments and distributions carry `eventId`. UC03 and UC04 screens select an event | `core/events/DisasterEvent.ts`, `CoordinationScope.tsx`, `ReportsScreen.tsx` |
| U2 | UC02 statuses "Requires Additional Information" and "Pending Synchronization" missing from `ReportStatus` | `ReportStatus` = PENDING_SYNC, PENDING_VERIFICATION, NEEDS_MORE_INFO, VERIFIED, REJECTED, with an explicit transition table | `reports/domain/ReportStatus.ts` |
| U3 | Rescue statuses "En Route" / "On Scene" (UC03 A4) don't match `STANDBY/DISPATCHED/ON_SITE/RETURNING` | `RescueTeamStatus` = STANDBY → DISPATCHED → EN_ROUTE → ON_SCENE → RETURNING → STANDBY (state machine) | `dispatch/domain/RescueTeam.ts` |
| U4 | `ReportVerification` 1:1 with `GroundReport` cannot support the "request more info" loop | `GroundReport` 1 → 0..* `ReportReview` (decision, comment, credibility, time) and 0..* `Supplement` | `reports/domain/GroundReport.ts` |
| U5 | `Citizen.district` is a String, although district targeting depends on it | `UserAccount.homeDistrictId` references `District`. `ReportLocation.districtId` is derived from GPS via `GeoDirectory.nearestDistrict` | `core/users/UserAccount.ts`, `reports/domain/ReportLocation.ts` |
| U6 | Duty Officer is a secondary actor in UC01 but never appears in its sequence diagram | UC01 dashboard lists duty-officer-verified reports. A warning or escalation can cite them (`supportingReportIds`) | `WarningsDashboardScreen.tsx`, `HazardAlert.supportingReportIds` |
| U7 | `ShelterStatus` has no state for a shelter that becomes unusable (UC03 E2) | Added `UNAVAILABLE` (with reason), derived together with the 80% near-capacity rule | `shelters/domain/Shelter.ts` |
| U8 | Occupancy "over time" (UC04) cannot be produced from a single `currentOccupancy` field | Every allocation or release records an `OccupancySnapshot` | `ShelterCoordinationService.snapshot()` |
| U9 | Donor report access (UC04 A3, E3) not modelled | `ReportAccessPolicy` strategies (DMC official: all; donor: own resource distribution only) | `analytics/application/ReportAccessPolicy.ts` |

## 3. Interaction design (HCI) corrections

| # | Critique | Change in the UI |
|---|---|---|
| H1 | UC01/UC03 wireframes show citizen screens instead of the DMC / district officer's forms and dashboards | Role-based tabs: DMC officer gets *Hazard Warning Dashboard → Form → Review & Confirm → Delivery monitoring*; district officer gets *Overview / Shelters* (UC03) and *Teams / Relief* (UC04); duty officer gets a review queue. The citizen screens from the wireframes (critical alert, active warnings, shelter finder) are kept for the citizen role |
| H2 | UC04 wireframes (Volunteer Tasks, Preparedness Hub) are unrelated to report generation | Our UC05 screens follow the original UC04 storyboard: filters (event, categories, districts, period) → report with timeline, reach, occupancy chart, distribution → Export CSV/JSON through the share sheet |
| H3 | Storyboards show desktop monitors, but the system is mobile-only | Every screen is a mobile layout (max 430 px, bottom tab bar, thumb-reachable primary actions) |
| H4 | Low-fi screens use US conventions (miles, ST 12345, (555), ADA, National Weather Service) | Sri Lankan data only: km, +94 numbers, 119 emergency number, real districts and river basins, DMC / Divisional Secretariat owners |
| H5 | No offline / sync state in the hi-fi screens | Online/Offline pill with pending-sync counter on every screen, "Saved on this device" confirmation, Hub outbox list with **Sync now** |
| H6 | Validation feedback not designed | All fields of a form are highlighted at once (E1/E3). Each message clears as soon as that field is corrected. Review-and-confirm step before broadcasting a warning (error prevention) |
| H7 | "SOS" tab is not part of any use case | The tab became **Report** (UC02). The call-119 action stays on the critical alert screen |

## 4. Scope note

* Login, logout and privilege management are intentionally **not** implemented (assignment
  brief). A persona switcher replaces login for the demo.
* SMS gateway, push network, GPS and the central server are **simulated** behind interfaces, as
  the FAQ allows. Replacing a simulator with a real provider means writing one adapter class.

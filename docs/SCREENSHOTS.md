# UI flow with screenshots

Screens captured from the running app at 390 x 844 px (`npm run screenshots`). Step numbers refer to the use case scenarios in the report. A means an alternate flow and E an exception flow.

## UC01 Issue Hazard Warning

### DMC Officer: Hazard Warning Dashboard (steps 1 to 2)

Active warnings with their expiry and delivery reach, ground reports verified by the Duty Officer, and a notice for queued deliveries with a Retry now link (E2).

<img src="screenshots/uc01-01-warning-dashboard.png" width="300" alt="DMC Officer: Hazard Warning Dashboard (steps 1 to 2)">

### Hazard Warning Form with invalid input (E1)

Submitting an empty form highlights every missing field at the same time.

<img src="screenshots/uc01-02-form-validation-errors.png" width="300" alt="Hazard Warning Form with invalid input (E1)">

### Hazard Warning Form completed (steps 3 to 8)

Hazard type with its onset speed, warning level, target scope switch (district or river basin), headline, description, and a validity that is limited by the hazard type.

<img src="screenshots/uc01-03-form-filled.png" width="300" alt="Hazard Warning Form completed (steps 3 to 8)">

### Review and confirm (steps 9 to 10)

Shows the target districts, how many registered citizens were found, the channels (push, SMS and the audible override for Critical) and the validity before anything is broadcast.

<img src="screenshots/uc01-04-review-confirm.png" width="300" alt="Review and confirm (steps 9 to 10)">

### Warning issued (steps 11 to 16)

The warning is stored and broadcast. The officer sees how many citizens were targeted, reached and queued for retry, and the result per channel.

<img src="screenshots/uc01-05-issued-delivery-summary.png" width="300" alt="Warning issued (steps 11 to 16)">

### Delivery monitoring and escalation (A1)

The officer can raise the level with a reason and supporting verified reports, and the update is broadcast again. The warning can also be marked as resolved.

<img src="screenshots/uc01-06-monitor-and-escalate.png" width="300" alt="Delivery monitoring and escalation (A1)">

### Citizen receives a critical alert

A Critical warning takes over the home screen with Find Nearest Shelter, Call 119 and Dismiss.

<img src="screenshots/uc01-07-citizen-critical-alert.png" width="300" alt="Citizen receives a critical alert">

### Citizen: Active Warnings

Warnings for the citizen's own district, colour coded by level, with Active and Archived tabs.

<img src="screenshots/uc01-08-citizen-active-warnings.png" width="300" alt="Citizen: Active Warnings">

### Citizen: warning detail

Affected regions, the description, the escalation history, Find Nearest Shelter and Share Alert.

<img src="screenshots/uc01-09-citizen-warning-detail.png" width="300" alt="Citizen: warning detail">

## UC02 Submit & Verify Hazard Report

### Report Incident with missing information (E3)

All required fields are highlighted when the reporter submits too early.

<img src="screenshots/uc02-01-report-missing-fields.png" width="300" alt="Report Incident with missing information (E3)">

### GPS location locked and an invalid photo (steps 3 to 7, E4)

The GPS position is mapped to its district and a valid photo is attached. A PDF is refused with a clear message, and each error clears as soon as the field is fixed.

<img src="screenshots/uc02-02-report-form-invalid-photo.png" width="300" alt="GPS location locked and an invalid photo (steps 3 to 7, E4)">

### Report submitted (steps 8 to 11)

The report is stored as Pending Verification and the Duty Officer is notified.

<img src="screenshots/uc02-03-report-submitted.png" width="300" alt="Report submitted (steps 8 to 11)">

### Offline submission (E2)

With no network the report is saved on the device as Pending Synchronization. The header shows Offline and the number of items waiting.

<img src="screenshots/uc02-04-offline-pending-sync.png" width="300" alt="Offline submission (E2)">

### Hub with the offline outbox

Notifications, the persona switcher, items waiting to sync with a Sync now button, and the simulation controls for network, SMS gateway, GPS and server failure.

<img src="screenshots/uc02-05-hub-offline-outbox.png" width="300" alt="Hub with the offline outbox">

### Reporter asked for more information (A1)

The Duty Officer asked a question. The reporter answers and the report goes back to Pending Verification.

<img src="screenshots/uc02-06-citizen-more-info-requested.png" width="300" alt="Reporter asked for more information (A1)">

### Duty Officer: review queue (step 12)

Pending reports ordered by assessed severity and then by age, showing the reporter type and the number of photos.

<img src="screenshots/uc02-07-duty-review-queue.png" width="300" alt="Duty Officer: review queue (step 12)">

### Duty Officer: review and verify (steps 13 to 17)

Photo, description, location and reporter details, with a decision panel to verify with a credibility score, request more information, or reject.

<img src="screenshots/uc02-08-duty-review-verify.png" width="300" alt="Duty Officer: review and verify (steps 13 to 17)">

### A rejection needs a reason (A2)

A report cannot be rejected without telling the reporter why.

<img src="screenshots/uc02-09-duty-reject-reason-required.png" width="300" alt="A rejection needs a reason (A2)">

## UC03 Coordinate Emergency Shelters

### District Officer: Emergency Coordination (steps 1 to 3)

Select the active disaster event and the district. The combined view shows shelter capacity and use, rescue teams by status, and relief distributed by category.

<img src="screenshots/uc03-01-coordination-overview.png" width="300" alt="District Officer: Emergency Coordination (steps 1 to 3)">

### Shelters in the district (step 4)

Occupancy and remaining places for every shelter, plus Register shelter (A2).

<img src="screenshots/uc03-02-shelter-list.png" width="300" alt="Shelters in the district (step 4)">

### Allocation leaves a shelter near capacity (steps 5 to 8, A1)

After the allocation the shelter is above 80 percent, so the officer sees the remaining places and nearby alternatives.

<img src="screenshots/uc03-03-shelter-near-capacity.png" width="300" alt="Allocation leaves a shelter near capacity (steps 5 to 8, A1)">

### Allocation refused with alternatives (E1)

Asking for more places than are left is refused, and nearby shelters that can take everyone are listed, nearest first.

<img src="screenshots/uc03-04-shelter-capacity-exceeded-alternatives.png" width="300" alt="Allocation refused with alternatives (E1)">

### Shelter becomes unavailable (E2)

The shelter is closed with a reason, district officers are notified, and nearby alternatives are suggested. It can be reopened later (A4).

<img src="screenshots/uc03-05-shelter-unavailable.png" width="300" alt="Shelter becomes unavailable (E2)">

### Citizen: nearest shelters

Open shelters with space, nearest first, using the live occupancy kept by the district officer.

<img src="screenshots/uc03-06-citizen-nearest-shelters.png" width="300" alt="Citizen: nearest shelters">

### Citizen: shelter detail

Capacity, emergency desk phone, managing organisation, facilities, directions and a call button.

<img src="screenshots/uc03-07-citizen-shelter-detail.png" width="300" alt="Citizen: shelter detail">

## UC04 Dispatch Rescue Teams & Relief Resources

### Rescue teams for the district (steps 1 to 2)

Teams already deployed with their live status, and teams on standby in the district. A team that has not left yet can be recalled (A3).

<img src="screenshots/uc04-01-rescue-teams.png" width="300" alt="Rescue teams for the district (steps 1 to 2)">

### Dispatch a team from another district or organisation (steps 3 to 5, A1)

When no local team is suitable the officer borrows one from elsewhere, and the assignment is recorded as cross-organisation.

<img src="screenshots/uc04-02-dispatch-cross-organisation.png" width="300" alt="Dispatch a team from another district or organisation (steps 3 to 5, A1)">

### Relief supplies with insufficient stock (steps 9 to 12, A2, E1)

Stock pooled across Government, Armed Forces, NGOs and Private Donors, filterable by owner. Asking for more than is available shows the shortage.

<img src="screenshots/uc04-03-relief-insufficient-stock.png" width="300" alt="Relief supplies with insufficient stock (steps 9 to 12, A2, E1)">

### Rescue Team: status update (step 6)

The team sees its assignment and confirms each step from the field. This also works offline (E2).

<img src="screenshots/uc04-04-rescue-team-status.png" width="300" alt="Rescue Team: status update (step 6)">

### Rescue Team: mission outcome (steps 7 to 8)

On scene, the team records how many people were rescued and starts the return. The record feeds the UC05 Rescue Operations section.

<img src="screenshots/uc04-05-rescue-mission-outcome.png" width="300" alt="Rescue Team: mission outcome (steps 7 to 8)">

## UC05 Generate Disaster Response Reports

### Disaster Response Reports: criteria (steps 1 to 7)

Select the disaster event, the report categories (A2), the districts (A1) and the reporting period (A4).

<img src="screenshots/uc05-01-report-criteria.png" width="300" alt="Disaster Response Reports: criteria (steps 1 to 7)">

### Generated report (steps 8 to 17)

Alert timeline, citizens reached per district, shelter occupancy over time, resource distribution by district and contributor, and rescue operations. Export to CSV, JSON or print to PDF.

<img src="screenshots/uc05-02-generated-report.png" width="300" alt="Generated report (steps 8 to 17)">

### Invalid reporting period (E2)

An end date before the start date is refused with a message on the period field.

<img src="screenshots/uc05-03-invalid-period.png" width="300" alt="Invalid reporting period (E2)">

### Donor asks for restricted information (E3)

Shelter and citizen statistics are restricted to DMC officials, so the donor is told what they can see instead.

<img src="screenshots/uc05-04-donor-unauthorised.png" width="300" alt="Donor asks for restricted information (E3)">

### Donor-specific report (A3)

Only the resources contributed by the donor (Red Cross) are included.

<img src="screenshots/uc05-05-donor-specific-report.png" width="300" alt="Donor-specific report (A3)">

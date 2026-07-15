# NETRA ↔ Official KSP ERD alignment

The organizers published an official dataset design — **"Police FIR System — ER Diagram / Database
Design Document" (Karnataka Police Department)** — under the datathon Resources. NETRA's data model
is deliberately aligned to it, so the prototype maps cleanly onto the schema judges expect and onto
a real CCTNS-style FIR database.

> The official ERD is marked **Confidential**; it is **not** redistributed in this public repo (it is
> git-ignored). This document captures only the *mapping* so our alignment is auditable.

## Core mapping (official entity → NETRA)

| Official ERD entity | Purpose | NETRA representation |
|---|---|---|
| **CaseMaster** | Central FIR/case record (CrimeNo, dates, lat/long, brief facts, FKs to station/status/heads) | `firs` (id, crime_type, ipc_bns_sections, occurred_at/reported_at, district, ps_code, lat, lng, status, narrative) |
| **Accused** | Accused persons per case (A1, A2…) | `persons` linked via `fir_accused` (role, arrest_status) |
| **Victim** | Victims per case | `persons` linked via `fir_victim` (injury, loss) |
| **ComplainantDetails** | Complainant + caste/religion/occupation (special-category PII) | folded into `persons` (socio_economic_band, occupation) + victim link *(see PII note)* |
| **ArrestSurrender** (+ `inv_arrestsurrenderaccused`) | Arrest/surrender events per accused | `fir_accused.arrest_status` (arrested / absconding / bailed) |
| **ChargesheetDetails** (cstype A/B/C) | Final report / disposal | `firs.status` (`chargesheeted` / `closed` / `under_investigation`) |
| **ActSectionAssociation → Act, Section** | Acts & sections invoked (e.g. IPC 302) | `firs.ipc_bns_sections[]` (IPC/BNS codes) |
| **CrimeHead / CrimeSubHead** | Major/minor crime classification | `firs.crime_type` + `mo_tags` |
| **CaseStatusMaster** | Status lookup | `firs.status` |
| **CaseCategory / GravityOffence** | FIR/UDR/PAR category; heinous/non-heinous | `crime_type` severity weighting in the risk engine |
| **District / State** | Geography lookups | `districts` (real Karnataka districts + socio-economic indicators) |
| **Unit (police station, hierarchical)** | Police units/stations | `stations` (ps_code, name, district, lat, lng) |
| **Court / Employee / Rank / Designation / UnitType** | Court + officer masters | not modelled in the prototype (out of PS1 scope; easy to add as lookups) |
| **Inv_OccuranceTime** | Occurrence time-of-day | encoded in `occurred_at` (MO-consistent hour-of-day) |

## NETRA extensions (analytics layer on top of the base FIR schema)
The official ERD models the FIR *system of record*. PS1 asks for **relationship, financial, and
predictive intelligence**, which need graph + transaction tables the base ERD doesn't include. NETRA
adds these as an analytics layer:
- `associations` — person↔person edges (co-offender, associate, family, phone, vehicle, financial) → criminal-network analysis (PS1 §2).
- `accounts`, `transactions` — financial graph → money-trail / structuring detection (PS1 §7).
These derive from / attach to CaseMaster-equivalent records and would, in production, be materialised
from CCTNS + bank/CDR feeds.

## Notable ERD details we honour
- **CrimeNo is an 18-digit structured key** (category + district + unit + year + serial). Our FIR IDs
  are human-readable (`FIR-YYYY-<DIST>-<serial>`); the loader can adopt the exact 18-digit CrimeNo when
  ingesting the official dataset.
- **Special-category PII** (caste, religion, occupation on ComplainantDetails) is exactly why NETRA's
  **role-based PII redaction + audit log** (PS1 §10) matter — lower roles never see these fields.
- **DateTime formatting** for Catalyst Data Store import is normalised to `YYYY-MM-DD HH:MM:SS`
  (`catalyst/scripts/seed-to-csv.mjs`); arrays (sections, MO tags) are stored as delimited Text and
  parsed on read, per Catalyst Data Store's type set (no native array/JSON column).

## Swapping in the official dataset
When the organizer's dataset is loaded, the `DataProvider` (`packages/core/src/providers`) maps its
tables onto NETRA's canonical types — `CaseMaster→Fir`, `Accused/Victim→Person`, etc. — so every
analytic and the whole conversational layer work unchanged on real records. See `catalyst/DEPLOY.md`.

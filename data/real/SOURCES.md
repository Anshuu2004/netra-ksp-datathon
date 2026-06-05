# Real public data sources (Tier A)

Real Government-of-India / Government-of-Karnataka open crime data used by NETRA for
district-level trend, hotspot, and socio-economic analytics. These are genuine official figures.

| File | Description | Source |
|---|---|---|
| `ka_total_crimes_2023.csv` | District & city-wise IPC + SLL crimes registered, Karnataka 2023 (214,234 total) | OpenCity Urban Data Portal — Karnataka Crime Data 2023 |
| `ka_deaths_crime_negligence_2023.csv` | District/city-wise deaths due to crime & negligence, 2023 | OpenCity / Govt of Karnataka |
| `ka_sexual_harassment_2023.csv` | District/city-wise sexual harassment cases, 2023 | OpenCity / Govt of Karnataka |

Source portals:
- OpenCity — Karnataka Crime Data 2023: https://data.opencity.in/dataset/karnataka-crime-data-2023
- NCRB on data.gov.in: https://www.data.gov.in/catalog/district-wise-crimes-under-various-sections-indian-penal-code-ipc-crimes
- NCRB official: https://www.ncrb.gov.in

Note: All public Indian crime data is **aggregate** (district/state level). No public record-level
FIR dataset exists; see `docs/DATA_POLICY.md` for how NETRA handles record-level features.

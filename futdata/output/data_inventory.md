# Data inventory

Source: `/Users/amaisuarez/Desktop/futdata`  
Generated: 2026-10-27T09:16:03

## Files

| file | competition | season | rows | columns | encoding | delimiter | date range | date format |
|---|---|---|---|---|---|---|---|---|
| SP1-2.csv | SP1 | 2025/26 | 380 | 131 | utf-8-sig | ',' | 2025-08-15 → 2026-05-24 | dd/mm/yyyy |
| SP1-3.csv | SP1 | 2024/25 | 380 | 119 | utf-8-sig | ',' | 2024-08-15 → 2025-05-25 | dd/mm/yyyy |
| SP1-4.csv | SP1 | 2023/24 | 380 | 105 | utf-8 | ',' | 2023-08-11 → 2024-05-26 | dd/mm/yyyy |
| SP1-5.csv | SP1 | 2022/23 | 380 | 105 | utf-8 | ',' | 2022-08-12 → 2023-06-04 | dd/mm/yyyy |
| SP1-6.csv | SP1 | 2021/22 | 380 | 105 | utf-8 | ',' | 2021-08-13 → 2022-05-22 | dd/mm/yyyy |
| SP1.csv | SP1 | 2026/27 | 99 | 113 | utf-8-sig | ',' | 2026-08-15 → 2026-10-26 | dd/mm/yyyy |

Fixture schedule files: none supplied. Future fixtures must be created manually; none are invented.

## Seasons

| competition | season | matches | teams | state | completeness | dates |
|---|---|---|---|---|---|---|
| SP1 | 2021/22 | 380 | 20 | complete | 100% | 2021-08-13 → 2022-05-22 |
| SP1 | 2022/23 | 380 | 20 | complete | 100% | 2022-08-12 → 2023-06-04 |
| SP1 | 2023/24 | 380 | 20 | complete | 100% | 2023-08-11 → 2024-05-26 |
| SP1 | 2024/25 | 380 | 20 | complete | 100% | 2024-08-15 → 2025-05-25 |
| SP1 | 2025/26 | 380 | 20 | complete | 100% | 2025-08-15 → 2026-05-24 |
| SP1 | 2026/27 | 99 | 20 | partial (in progress) | 26% | 2026-08-15 → 2026-10-26 |

## Statistical coverage (share of matches with the statistic)

| season | goals | shots | sot | corners | fouls | yellows | reds | ht_goals | woodwork | offsides | fk_conceded | booking_pts | xg_undocumented |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2021/22 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| 2022/23 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| 2023/24 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| 2024/25 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| 2025/26 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 0% |
| 2026/27 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% | 0% | 100% |

## Column documentation

- documented: 91 columns
- documented_rule: 68 columns
- inferred_pattern: 8 columns
- undocumented: 8 columns

### Columns not literally documented in notes.txt

| column | status | interpretation | files |
|---|---|---|---|
| BFE>2.5 | inferred_pattern | Betfair Exchange over 2.5 goals (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFE<2.5 | inferred_pattern | Betfair Exchange under 2.5 goals (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFEAHH | inferred_pattern | Betfair Exchange Asian handicap home team odds (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFEAHA | inferred_pattern | Betfair Exchange Asian handicap away team odds (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFEC>2.5 | inferred_pattern | Betfair Exchange closing over 2.5 goals (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFEC<2.5 | inferred_pattern | Betfair Exchange closing under 2.5 goals (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFECAHH | inferred_pattern | Betfair Exchange closing Asian handicap home team odds (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| BFECAHA | inferred_pattern | Betfair Exchange closing Asian handicap away team odds (pattern inferred, not listed in notes.txt) | SP1-2.csv, SP1-3.csv, SP1.csv |
| HxG | undocumented | **unknown — flagged** | SP1.csv |
| AxG | undocumented | **unknown — flagged** | SP1.csv |
| SKBH | undocumented | **unknown — flagged** | SP1.csv |
| SKBD | undocumented | **unknown — flagged** | SP1.csv |
| SKBA | undocumented | **unknown — flagged** | SP1.csv |
| SKBCH | undocumented | **unknown — flagged** | SP1.csv |
| SKBCD | undocumented | **unknown — flagged** | SP1.csv |
| SKBCA | undocumented | **unknown — flagged** | SP1.csv |

Notes on undocumented columns:
- `HxG` / `AxG` appear only in the current-season file. The name suggests home/away expected goals and the values are consistent with that, but notes.txt does not define them (provider, model, penalties included?). They are preserved and displayed, not used for training.
- `SKBH/SKBD/SKBA` (and closing `SKBC*`) look like 1X2 bookmaker odds; notes.txt lists Skybet as `SKH/SKD/SKA`, so `SKB` may be Skybet under a new code. Ambiguous — preserved, not used.

## Schema differences between files

175 distinct columns; 73 present in every file; 102 vary by file (almost all bookmaker odds — bookmakers change between seasons).

| modelling-relevant column with partial presence | present in |
|---|---|
| HxG | SP1.csv |
| AxG | SP1.csv |
| SKBH | SP1.csv |
| SKBD | SP1.csv |
| SKBA | SP1.csv |
| SKBCH | SP1.csv |
| SKBCD | SP1.csv |
| SKBCA | SP1.csv |

Full original → normalized mapping: `output/column_mapping.csv`. All original columns are preserved in `output/raw_combined_all_columns.csv`.

## Team identities

| team id | display | raw names in data | confirmed in config |
|---|---|---|---|
| alaves | Alavés | Alaves | yes |
| almeria | Almería | Almeria | yes |
| ath-bilbao | Athletic Club | Ath Bilbao | yes |
| ath-madrid | Atlético Madrid | Ath Madrid | yes |
| barcelona | Barcelona | Barcelona | yes |
| betis | Real Betis | Betis | yes |
| cadiz | Cádiz | Cadiz | yes |
| celta | Celta Vigo | Celta | yes |
| elche | Elche | Elche | yes |
| espanyol | Espanyol | Espanol | yes |
| getafe | Getafe | Getafe | yes |
| girona | Girona | Girona | yes |
| granada | Granada | Granada | yes |
| la-coruna | Deportivo La Coruña | La Coruna | yes |
| las-palmas | Las Palmas | Las Palmas | yes |
| leganes | Leganés | Leganes | yes |
| levante | Levante | Levante | yes |
| malaga | Málaga | Malaga | yes |
| mallorca | Mallorca | Mallorca | yes |
| osasuna | Osasuna | Osasuna | yes |
| oviedo | Real Oviedo | Oviedo | yes |
| real-madrid | Real Madrid | Real Madrid | yes |
| santander | Racing Santander | Santander | yes |
| sevilla | Sevilla | Sevilla | yes |
| sociedad | Real Sociedad | Sociedad | yes |
| valencia | Valencia | Valencia | yes |
| valladolid | Valladolid | Valladolid | yes |
| vallecano | Rayo Vallecano | Vallecano | yes |
| villarreal | Villarreal | Villarreal | yes |

All raw team names resolved to confirmed identities; all look-alike pairs are recorded as confirmed distinct in `config/teams.json`.

## Season participation

| team | 2021/22 | 2022/23 | 2023/24 | 2024/25 | 2025/26 | 2026/27 |
|---|---|---|---|---|---|---|
| Alavés | ○▼ |  | ▲ | ● | ● | ● |
| Almería |  | ▲ | ●▼ |  |  |  |
| Athletic Club | ○ | ● | ● | ● | ● | ● |
| Atlético Madrid | ○ | ● | ● | ● | ● | ● |
| Barcelona | ○ | ● | ● | ● | ● | ● |
| Real Betis | ○ | ● | ● | ● | ● | ● |
| Cádiz | ○ | ● | ●▼ |  |  |  |
| Celta Vigo | ○ | ● | ● | ● | ● | ● |
| Elche | ○ | ●▼ |  |  | ▲ | ● |
| Espanyol | ○ | ●▼ |  | ▲ | ● | ● |
| Getafe | ○ | ● | ● | ● | ● | ● |
| Girona |  | ▲ | ● | ● | ●▼ |  |
| Granada | ○▼ |  | ▲▼ |  |  |  |
| Deportivo La Coruña |  |  |  |  |  | ▲ |
| Las Palmas |  |  | ▲ | ●▼ |  |  |
| Leganés |  |  |  | ▲▼ |  |  |
| Levante | ○▼ |  |  |  | ▲ | ● |
| Málaga |  |  |  |  |  | ▲ |
| Mallorca | ○ | ● | ● | ● | ●▼ |  |
| Osasuna | ○ | ● | ● | ● | ● | ● |
| Real Oviedo |  |  |  |  | ▲▼ |  |
| Real Madrid | ○ | ● | ● | ● | ● | ● |
| Racing Santander |  |  |  |  |  | ▲ |
| Sevilla | ○ | ● | ● | ● | ● | ● |
| Real Sociedad | ○ | ● | ● | ● | ● | ● |
| Valencia | ○ | ● | ● | ● | ● | ● |
| Valladolid |  | ▲▼ |  | ▲▼ |  |  |
| Rayo Vallecano | ○ | ● | ● | ● | ● | ● |
| Villarreal | ○ | ● | ● | ● | ● | ● |

○ first season in dataset (prior status unknown) · ● continuing · ▲ entered (promoted / returning; source division not in data) · ▼ not in the next season (relegated)

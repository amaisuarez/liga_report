# Data quality report

## Checks

| check | severity | rows | decision |
|---|---|---|---|
| goals exceed shots on target | info | 20 | kept: consistent with own goals, which are not shots by the scoring side |

Checks run: unparseable dates, home = away, duplicate matches, repeated pairings within a season, FTR vs goals, half-time > full-time, shots on target > shots, goals > shots on target, negative values, implausible values.

### Rows flagged

| file | line | date | match | check | values |
|---|---|---|---|---|---|
| SP1-6.csv | 145 | 2021-11-28 | Cadiz v Ath Madrid | goals exceed shots on target | {'home_goals': 1, 'home_sot': 0, 'away_goals': 4, 'away_sot': 7} |
| SP1-6.csv | 154 | 2021-12-05 | Vallecano v Espanol | goals exceed shots on target | {'home_goals': 1, 'home_sot': 0, 'away_goals': 0, 'away_sot': 3} |
| SP1-6.csv | 263 | 2022-03-05 | Espanol v Getafe | goals exceed shots on target | {'home_goals': 2, 'home_sot': 1, 'away_goals': 0, 'away_sot': 3} |
| SP1-6.csv | 264 | 2022-03-05 | Valencia v Granada | goals exceed shots on target | {'home_goals': 3, 'home_sot': 4, 'away_goals': 1, 'away_sot': 0} |
| SP1-6.csv | 312 | 2022-04-16 | Elche v Mallorca | goals exceed shots on target | {'home_goals': 3, 'home_sot': 2, 'away_goals': 0, 'away_sot': 2} |
| SP1-6.csv | 356 | 2022-05-11 | Osasuna v Getafe | goals exceed shots on target | {'home_goals': 1, 'home_sot': 1, 'away_goals': 1, 'away_sot': 0} |
| SP1-5.csv | 102 | 2022-10-22 | Vallecano v Cadiz | goals exceed shots on target | {'home_goals': 5, 'home_sot': 11, 'away_goals': 1, 'away_sot': 0} |
| SP1-5.csv | 289 | 2023-04-16 | Ath Madrid v Almeria | goals exceed shots on target | {'home_goals': 2, 'home_sot': 7, 'away_goals': 1, 'away_sot': 0} |
| SP1-5.csv | 295 | 2023-04-22 | Sociedad v Vallecano | goals exceed shots on target | {'home_goals': 2, 'home_sot': 1, 'away_goals': 1, 'away_sot': 2} |
| SP1-4.csv | 20 | 2023-08-21 | Alaves v Sevilla | goals exceed shots on target | {'home_goals': 4, 'home_sot': 7, 'away_goals': 3, 'away_sot': 2} |
| SP1-4.csv | 68 | 2023-09-28 | Celta v Alaves | goals exceed shots on target | {'home_goals': 1, 'home_sot': 0, 'away_goals': 1, 'away_sot': 11} |
| SP1-4.csv | 312 | 2024-04-19 | Ath Bilbao v Granada | goals exceed shots on target | {'home_goals': 1, 'home_sot': 6, 'away_goals': 1, 'away_sot': 0} |
| SP1-4.csv | 379 | 2024-05-26 | Celta v Valencia | goals exceed shots on target | {'home_goals': 2, 'home_sot': 4, 'away_goals': 2, 'away_sot': 1} |
| SP1-3.csv | 147 | 2024-12-01 | Sociedad v Betis | goals exceed shots on target | {'home_goals': 2, 'home_sot': 1, 'away_goals': 0, 'away_sot': 2} |
| SP1-3.csv | 272 | 2025-03-15 | Mallorca v Espanol | goals exceed shots on target | {'home_goals': 2, 'home_sot': 7, 'away_goals': 1, 'away_sot': 0} |
| SP1-2.csv | 156 | 2025-12-13 | Mallorca v Elche | goals exceed shots on target | {'home_goals': 3, 'home_sot': 8, 'away_goals': 1, 'away_sot': 0} |
| SP1-2.csv | 229 | 2026-02-09 | Villarreal v Espanol | goals exceed shots on target | {'home_goals': 4, 'home_sot': 3, 'away_goals': 1, 'away_sot': 2} |
| SP1-2.csv | 272 | 2026-03-13 | Alaves v Villarreal | goals exceed shots on target | {'home_goals': 1, 'home_sot': 0, 'away_goals': 1, 'away_sot': 4} |
| SP1-2.csv | 303 | 2026-04-11 | Sociedad v Alaves | goals exceed shots on target | {'home_goals': 3, 'home_sot': 4, 'away_goals': 3, 'away_sot': 2} |
| SP1-2.csv | 317 | 2026-04-22 | Sociedad v Getafe | goals exceed shots on target | {'home_goals': 0, 'home_sot': 4, 'away_goals': 1, 'away_sot': 0} |

## Matches per team per season

| season | min | max |
|---|---|---|
| 2021/22 | 38 | 38 |
| 2022/23 | 38 | 38 |
| 2023/24 | 38 | 38 |
| 2024/25 | 38 | 38 |
| 2025/26 | 38 | 38 |
| 2026/27 | 6 | 8 |

## Cross-season consistency of statistics

Per-team-per-match means. z compares a season with the pooled other seasons; |z| > 4 is flagged. notes.txt documents no definition change for these variables in Spain (fouls are recorded directly, not free kicks conceded; yellow-card counting follows the European convention throughout), so drift is treated as a real trend and absorbed by time-decay weighting and league-relative features.

**Goals**: 2021/22 1.251 (z=-1.43) · 2022/23 1.257 (z=-1.36) · 2023/24 1.322 (z=0.38) · 2024/25 1.309 (z=0.06) · 2025/26 1.347 (z=1.11) · 2026/27 1.545 (z=2.18)

**Shots**: 2021/22 11.775 (z=-2.65) · 2022/23 12.312 (z=0.81) · 2023/24 12.232 (z=0.32) · 2024/25 11.846 (z=-1.9) · 2025/26 12.489 (z=1.76) · 2026/27 13.365 (z=2.54)

**Shots on target**: 2021/22 3.978 (z=-2.9) · 2022/23 4.196 (z=-0.03) · 2023/24 4.309 (z=1.36) · 2024/25 4.068 (z=-1.65) · 2025/26 4.336 (z=1.75) · 2026/27 4.718 (z=2.42)

**Corners**: 2021/22 4.712 (z=-0.51) · 2022/23 4.767 (z=0.11) · 2023/24 4.683 (z=-0.82) · 2024/25 4.759 (z=0.03) · 2025/26 4.833 (z=0.83) · 2026/27 4.891 (z=0.57)

**Fouls committed**: 2021/22 13.218 (z=3.37) · 2022/23 12.947 (z=1.15) · 2023/24 12.928 (z=1.01) · 2024/25 12.366 (z=-3.26) · 2025/26 12.582 (z=-1.61) · 2026/27 12.385 (z=-1.32)

**Yellow cards**: 2021/22 2.571 (z=3.93) · 2022/23 2.509 (z=2.52) · 2023/24 2.384 (z=0.25) · 2024/25 2.241 (z=-2.6) · 2025/26 2.207 (z=-3.42) · 2026/27 2.115 (z=-2.43)

**Red cards**: 2021/22 0.116 (z=-1.27) · 2022/23 0.178 (z=3.51) · 2023/24 0.114 (z=-1.4) · 2024/25 0.103 (z=-2.56) · 2025/26 0.136 (z=0.45) · 2026/27 0.141 (z=0.39)

**Half-time goals**: 2021/22 0.546 (z=-1.19) · 2022/23 0.559 (z=-0.65) · 2023/24 0.599 (z=0.92) · 2024/25 0.576 (z=0.03) · 2025/26 0.575 (z=-0.02) · 2026/27 0.686 (z=1.6)

**xG (undocumented column)**: 2026/27 1.4599358974358974 (z=None)

## Prediction targets

| statistic | modelled | seasons with data | reason if not |
|---|---|---|---|
| Goals | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Shots | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Shots on target | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Corners | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Fouls committed | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Yellow cards | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Red cards | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Half-time goals | yes | 2021/22, 2022/23, 2023/24, 2024/25, 2025/26, 2026/27 |  |
| Hit woodwork | no | – | Documented in notes.txt but not present in any CSV. |
| Offsides | no | – | Documented in notes.txt but not present in any CSV. |
| Free kicks conceded | no | – | Documented in notes.txt but not present in any CSV. |
| Booking points | no | – | Documented in notes.txt but not present in any CSV. |
| xG (undocumented column) | no | 2026/27 | Column is not documented in notes.txt; meaning cannot be validated, so it is shown but not modelled. |
| Possession | no | – | Ball possession is not defined in notes.txt and no column contains it. |

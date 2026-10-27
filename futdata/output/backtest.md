# Chronological backtest

Walk-forward: matches are predicted in weekly batches; every model is refitted on matches strictly before the batch. Hyper-parameters were chosen on the validation season only; test seasons were scored once.

## Goals

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/960) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 960.0, 'season_discount': 1.0, 'prior_sd': 0.3}, 'form_window': 'all'}
- Negative-binomial size (k, validation): Poisson adequate

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.2731 | 0.965 | 1.421 | -0.097 | 91.1% |
| validation | ratings | 380 | 1.1340 | 0.899 | 1.348 | -0.060 | 93.8% |
| validation | form | 380 | 1.1666 | 0.921 | 1.403 | +0.009 | 94.3% |
| test | baseline | 859 | 1.1203 | 0.901 | 1.291 | -0.106 | 94.4% |
| test | ratings | 859 | 0.9907 | 0.827 | 1.237 | -0.080 | 94.6% |
| test | form | 859 | 0.9969 | 0.838 | 1.242 | -0.036 | 95.0% |

Match outcome (1X2) and over/under 2.5 goals. *market* = normalized pre-closing market-average odds, a benchmark only (never a model input).

| split | model | matches | 1X2 log loss | Brier | RPS | accuracy | O/U2.5 log loss |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.0760 | 0.6508 | 0.2240 | 43.9% | 0.6907 |
| validation | ratings | 380 | 0.9670 | 0.5749 | 0.1881 | 52.6% | 0.6635 |
| validation | form | 380 | 0.9772 | 0.5811 | 0.1901 | 52.4% | 0.6855 |
| validation | market | 380 | 0.9492 | 0.5642 | 0.1825 | 55.5% | 0.6544 |
| test | baseline | 859 | 1.0615 | 0.6408 | 0.2260 | 46.4% | 0.6940 |
| test | ratings | 859 | 0.9724 | 0.5767 | 0.1962 | 52.9% | 0.6770 |
| test | form | 859 | 0.9772 | 0.5803 | 0.1979 | 53.1% | 0.6763 |
| test | market | 859 | 0.9554 | 0.5656 | 0.1916 | 54.8% | 0.6647 |

Low-evidence matches (a team with < 8 effective matches): 53 · ratings log loss 0.9764 vs market 0.9303

| season | dev baseline | dev ratings | dev form | 1X2 LL ratings | 1X2 LL market |
|---|---|---|---|---|---|
| 2023/24 | 1.2731 | 1.1340 | 1.1666 | 0.9670 | 0.9492 |
| 2024/25 | 1.1392 | 0.9911 | 1.0049 | 0.9754 | 0.9532 |
| 2025/26 | 1.0357 | 0.9539 | 0.9523 | 0.9758 | 0.9641 |
| 2026/27 | 1.3720 | 1.1303 | 1.1374 | 0.9477 | 0.9303 |

## Shots

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/240) x 0.7^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 240.0, 'season_discount': 0.7, 'prior_sd': 0.15}, 'form_window': 'all'}
- Negative-binomial size (k, validation): 20.9

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.7944 | 3.727 | 4.673 | +0.096 | 81.2% |
| validation | ratings | 380 | 1.6229 | 3.512 | 4.368 | +0.072 | 84.1% |
| validation | form | 380 | 1.6461 | 3.538 | 4.390 | +0.200 | 83.9% |
| test | baseline | 859 | 2.2431 | 4.127 | 4.761 | -0.370 | 76.0% |
| test | ratings | 859 | 1.7369 | 3.623 | 4.472 | -0.284 | 82.1% |
| test | form | 859 | 1.7273 | 3.614 | 4.455 | -0.244 | 82.3% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.7944 | 1.6229 | 1.6461 |
| 2024/25 | 2.2710 | 1.7083 | 1.7221 |
| 2025/26 | 2.1457 | 1.7189 | 1.7037 |
| 2026/27 | 2.5098 | 1.9157 | 1.8374 |

## Shots on target

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/960) x 0.7^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 960.0, 'season_discount': 0.7, 'prior_sd': 0.15}, 'form_window': 'all'}
- Negative-binomial size (k, validation): 21.1

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.4029 | 1.896 | 2.594 | -0.234 | 84.3% |
| validation | ratings | 380 | 1.2533 | 1.780 | 2.523 | -0.171 | 87.6% |
| validation | form | 380 | 1.2900 | 1.830 | 2.529 | +0.096 | 86.3% |
| test | baseline | 859 | 1.4054 | 1.895 | 2.481 | -0.147 | 84.7% |
| test | ratings | 859 | 1.1694 | 1.698 | 2.364 | -0.114 | 88.6% |
| test | form | 859 | 1.1651 | 1.694 | 2.366 | -0.101 | 88.8% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.4029 | 1.2533 | 1.2900 |
| 2024/25 | 1.4286 | 1.1694 | 1.1791 |
| 2025/26 | 1.3387 | 1.1479 | 1.1338 |
| 2026/27 | 1.5728 | 1.2519 | 1.2314 |

## Corners

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/120) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 120.0, 'season_discount': 1.0, 'prior_sd': 0.15}, 'form_window': 'all'}
- Negative-binomial size (k, validation): 11.2

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.5800 | 2.099 | 2.522 | +0.170 | 85.7% |
| validation | ratings | 380 | 1.5271 | 2.074 | 2.535 | +0.185 | 86.2% |
| validation | form | 380 | 1.5510 | 2.106 | 2.567 | +0.147 | 85.9% |
| test | baseline | 859 | 1.6215 | 2.154 | 2.739 | -0.089 | 85.1% |
| test | ratings | 859 | 1.4752 | 2.052 | 2.668 | -0.003 | 87.2% |
| test | form | 859 | 1.4820 | 2.058 | 2.668 | -0.040 | 86.4% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.5800 | 1.5271 | 1.5510 |
| 2024/25 | 1.5476 | 1.4116 | 1.4256 |
| 2025/26 | 1.6392 | 1.4992 | 1.5001 |
| 2026/27 | 1.8367 | 1.6275 | 1.6289 |

## Fouls committed

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/240) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 240.0, 'season_discount': 1.0, 'prior_sd': 0.15}, 'form_window': 'all'}
- Negative-binomial size (k, validation): 146.6

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.3290 | 3.265 | 4.764 | +0.218 | 82.2% |
| validation | ratings | 380 | 1.0934 | 2.935 | 4.385 | +0.282 | 85.5% |
| validation | form | 380 | 1.1122 | 2.980 | 4.403 | +0.012 | 85.0% |
| test | baseline | 859 | 1.2973 | 3.196 | 4.548 | +0.292 | 80.3% |
| test | ratings | 859 | 1.0859 | 2.898 | 4.121 | +0.319 | 84.7% |
| test | form | 859 | 1.1038 | 2.915 | 4.141 | -0.144 | 84.1% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.3290 | 1.0934 | 1.1122 |
| 2024/25 | 1.3313 | 1.1345 | 1.1377 |
| 2025/26 | 1.2893 | 1.0487 | 1.0843 |
| 2026/27 | 1.1976 | 1.0423 | 1.0487 |

## Yellow cards

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/120) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 120.0, 'season_discount': 1.0, 'prior_sd': 0.3}, 'form_window': 'all'}
- Negative-binomial size (k, validation): Poisson adequate

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.0650 | 1.207 | 1.848 | +0.112 | 85.7% |
| validation | ratings | 380 | 1.0174 | 1.175 | 1.839 | +0.189 | 92.2% |
| validation | form | 380 | 1.0366 | 1.172 | 1.836 | -0.041 | 90.3% |
| test | baseline | 859 | 1.1226 | 1.176 | 1.858 | +0.060 | 88.5% |
| test | ratings | 859 | 1.1101 | 1.172 | 1.832 | +0.127 | 90.3% |
| test | form | 859 | 1.1110 | 1.165 | 1.822 | -0.075 | 90.5% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0650 | 1.0174 | 1.0366 |
| 2024/25 | 1.2172 | 1.1978 | 1.2019 |
| 2025/26 | 1.0825 | 1.0789 | 1.0797 |
| 2026/27 | 0.9135 | 0.8928 | 0.8819 |

## Red cards

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/960) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 960.0, 'season_discount': 1.0, 'prior_sd': 0.15}, 'form_window': 'all'}
- Negative-binomial size (k, validation): Poisson adequate

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 0.5171 | 0.227 | 0.401 | +0.058 | 99.5% |
| validation | ratings | 380 | 0.5202 | 0.224 | 0.398 | +0.050 | 98.0% |
| validation | form | 380 | 0.5312 | 0.218 | 0.391 | +0.033 | 96.8% |
| test | baseline | 859 | 0.5440 | 0.221 | 0.392 | +0.011 | 99.0% |
| test | ratings | 859 | 0.5455 | 0.222 | 0.395 | +0.016 | 98.4% |
| test | form | 859 | 0.5526 | 0.212 | 0.378 | -0.012 | 95.1% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 0.5171 | 0.5202 | 0.5312 |
| 2024/25 | 0.4921 | 0.4936 | 0.5021 |
| 2025/26 | 0.5892 | 0.5917 | 0.5961 |
| 2026/27 | 0.5698 | 0.5680 | 0.5796 |

## Half-time goals

Validation: 2023/24 · Test: 2024/25, 2025/26, 2026/27
- Ratings training: all matches before each weekly batch from seasons 2021/22..; weights 0.5^(days/960) x 1^(seasons back)
- Form training: all seasons before the batch (warm-up season 2021/22 excluded)
- Chosen: {'ratings': {'half_life_days': 960.0, 'season_discount': 1.0, 'prior_sd': 0.3}, 'form_window': 'all'}
- Negative-binomial size (k, validation): Poisson adequate

| split | model | matches | Poisson deviance | MAE per side | MAE total | bias total | 80% interval coverage |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.0619 | 0.654 | 0.856 | -0.067 | 93.6% |
| validation | ratings | 380 | 1.0183 | 0.633 | 0.854 | -0.032 | 94.1% |
| validation | form | 380 | 1.0493 | 0.642 | 0.872 | -0.012 | 93.3% |
| test | baseline | 859 | 1.0560 | 0.648 | 0.845 | -0.025 | 94.0% |
| test | ratings | 859 | 0.9991 | 0.621 | 0.837 | -0.001 | 95.2% |
| test | form | 859 | 1.0180 | 0.625 | 0.836 | -0.031 | 94.6% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0619 | 1.0183 | 1.0493 |
| 2024/25 | 1.0607 | 1.0025 | 1.0227 |
| 2025/26 | 1.0131 | 0.9780 | 0.9887 |
| 2026/27 | 1.2020 | 1.0670 | 1.1120 |


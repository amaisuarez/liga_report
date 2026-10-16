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
| test | baseline | 838 | 1.1140 | 0.899 | 1.287 | -0.107 | 94.5% |
| test | ratings | 838 | 0.9841 | 0.823 | 1.230 | -0.083 | 94.7% |
| test | form | 838 | 0.9915 | 0.835 | 1.236 | -0.047 | 95.1% |

Match outcome (1X2) and over/under 2.5 goals. *market* = normalized pre-closing market-average odds, a benchmark only (never a model input).

| split | model | matches | 1X2 log loss | Brier | RPS | accuracy | O/U2.5 log loss |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.0760 | 0.6508 | 0.2240 | 43.9% | 0.6907 |
| validation | ratings | 380 | 0.9670 | 0.5749 | 0.1881 | 52.6% | 0.6635 |
| validation | form | 380 | 0.9772 | 0.5811 | 0.1901 | 52.4% | 0.6855 |
| validation | market | 380 | 0.9492 | 0.5642 | 0.1825 | 55.5% | 0.6544 |
| test | baseline | 838 | 1.0610 | 0.6405 | 0.2260 | 46.5% | 0.6940 |
| test | ratings | 838 | 0.9730 | 0.5771 | 0.1966 | 52.9% | 0.6762 |
| test | form | 838 | 0.9778 | 0.5807 | 0.1983 | 52.9% | 0.6759 |
| test | market | 838 | 0.9557 | 0.5658 | 0.1918 | 54.8% | 0.6651 |

Low-evidence matches (a team with < 8 effective matches): 50 · ratings log loss 0.9799 vs market 0.9284

| season | dev baseline | dev ratings | dev form | 1X2 LL ratings | 1X2 LL market |
|---|---|---|---|---|---|
| 2023/24 | 1.2731 | 1.1340 | 1.1666 | 0.9670 | 0.9492 |
| 2024/25 | 1.1392 | 0.9911 | 1.0049 | 0.9754 | 0.9532 |
| 2025/26 | 1.0357 | 0.9539 | 0.9523 | 0.9758 | 0.9641 |
| 2026/27 | 1.3730 | 1.0969 | 1.1179 | 0.9481 | 0.9271 |

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
| test | baseline | 838 | 2.2484 | 4.121 | 4.777 | -0.308 | 76.0% |
| test | ratings | 838 | 1.7419 | 3.625 | 4.471 | -0.224 | 82.3% |
| test | form | 838 | 1.7359 | 3.616 | 4.468 | -0.247 | 82.3% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.7944 | 1.6229 | 1.6461 |
| 2024/25 | 2.2710 | 1.7083 | 1.7221 |
| 2025/26 | 2.1457 | 1.7189 | 1.7037 |
| 2026/27 | 2.6385 | 2.0178 | 1.9604 |

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
| test | baseline | 838 | 1.4077 | 1.895 | 2.482 | -0.132 | 84.7% |
| test | ratings | 838 | 1.1693 | 1.695 | 2.367 | -0.102 | 88.6% |
| test | form | 838 | 1.1653 | 1.690 | 2.369 | -0.112 | 88.7% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.4029 | 1.2533 | 1.2900 |
| 2024/25 | 1.4286 | 1.1694 | 1.1791 |
| 2025/26 | 1.3387 | 1.1479 | 1.1338 |
| 2026/27 | 1.6427 | 1.2732 | 1.2518 |

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
| test | baseline | 838 | 1.6215 | 2.153 | 2.723 | -0.095 | 85.1% |
| test | ratings | 838 | 1.4739 | 2.051 | 2.645 | -0.011 | 87.3% |
| test | form | 838 | 1.4801 | 2.055 | 2.644 | -0.049 | 86.5% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.5800 | 1.5271 | 1.5510 |
| 2024/25 | 1.5476 | 1.4116 | 1.4256 |
| 2025/26 | 1.6392 | 1.4992 | 1.5001 |
| 2026/27 | 1.8952 | 1.6543 | 1.6485 |

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
| test | baseline | 838 | 1.3054 | 3.209 | 4.569 | +0.270 | 80.1% |
| test | ratings | 838 | 1.0890 | 2.905 | 4.121 | +0.293 | 84.7% |
| test | form | 838 | 1.1073 | 2.921 | 4.141 | -0.160 | 84.0% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.3290 | 1.0934 | 1.1122 |
| 2024/25 | 1.3313 | 1.1345 | 1.1377 |
| 2025/26 | 1.2893 | 1.0487 | 1.0843 |
| 2026/27 | 1.2572 | 1.0640 | 1.0709 |

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
| test | baseline | 838 | 1.1360 | 1.183 | 1.864 | +0.077 | 88.4% |
| test | ratings | 838 | 1.1234 | 1.178 | 1.837 | +0.143 | 90.2% |
| test | form | 838 | 1.1233 | 1.171 | 1.827 | -0.059 | 90.5% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0650 | 1.0174 | 1.0366 |
| 2024/25 | 1.2172 | 1.1978 | 1.2019 |
| 2025/26 | 1.0825 | 1.0789 | 1.0797 |
| 2026/27 | 1.0010 | 0.9772 | 0.9523 |

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
| test | baseline | 838 | 0.5437 | 0.220 | 0.391 | +0.012 | 99.0% |
| test | ratings | 838 | 0.5455 | 0.222 | 0.394 | +0.017 | 98.4% |
| test | form | 838 | 0.5521 | 0.211 | 0.377 | -0.012 | 95.0% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 0.5171 | 0.5202 | 0.5312 |
| 2024/25 | 0.4921 | 0.4936 | 0.5021 |
| 2025/26 | 0.5892 | 0.5917 | 0.5961 |
| 2026/27 | 0.5730 | 0.5731 | 0.5815 |

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
| test | baseline | 838 | 1.0537 | 0.647 | 0.845 | -0.028 | 94.0% |
| test | ratings | 838 | 0.9954 | 0.620 | 0.835 | -0.006 | 95.2% |
| test | form | 838 | 1.0143 | 0.623 | 0.835 | -0.039 | 94.6% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0619 | 1.0183 | 1.0493 |
| 2024/25 | 1.0607 | 1.0025 | 1.0227 |
| 2025/26 | 1.0131 | 0.9780 | 0.9887 |
| 2026/27 | 1.2175 | 1.0453 | 1.0981 |


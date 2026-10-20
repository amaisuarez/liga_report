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
| test | baseline | 848 | 1.1209 | 0.901 | 1.296 | -0.109 | 94.3% |
| test | ratings | 848 | 0.9890 | 0.826 | 1.240 | -0.084 | 94.6% |
| test | form | 848 | 0.9951 | 0.837 | 1.244 | -0.045 | 95.0% |

Match outcome (1X2) and over/under 2.5 goals. *market* = normalized pre-closing market-average odds, a benchmark only (never a model input).

| split | model | matches | 1X2 log loss | Brier | RPS | accuracy | O/U2.5 log loss |
|---|---|---|---|---|---|---|---|
| validation | baseline | 380 | 1.0760 | 0.6508 | 0.2240 | 43.9% | 0.6907 |
| validation | ratings | 380 | 0.9670 | 0.5749 | 0.1881 | 52.6% | 0.6635 |
| validation | form | 380 | 0.9772 | 0.5811 | 0.1901 | 52.4% | 0.6855 |
| validation | market | 380 | 0.9492 | 0.5642 | 0.1825 | 55.5% | 0.6544 |
| test | baseline | 848 | 1.0621 | 0.6412 | 0.2260 | 46.3% | 0.6939 |
| test | ratings | 848 | 0.9724 | 0.5766 | 0.1960 | 52.9% | 0.6766 |
| test | form | 848 | 0.9773 | 0.5803 | 0.1977 | 52.9% | 0.6761 |
| test | market | 848 | 0.9551 | 0.5654 | 0.1912 | 54.8% | 0.6650 |

Low-evidence matches (a team with < 8 effective matches): 53 · ratings log loss 0.9764 vs market 0.9303

| season | dev baseline | dev ratings | dev form | 1X2 LL ratings | 1X2 LL market |
|---|---|---|---|---|---|
| 2023/24 | 1.2731 | 1.1340 | 1.1666 | 0.9670 | 0.9492 |
| 2024/25 | 1.1392 | 0.9911 | 1.0049 | 0.9754 | 0.9532 |
| 2025/26 | 1.0357 | 0.9539 | 0.9523 | 0.9758 | 0.9641 |
| 2026/27 | 1.4097 | 1.1314 | 1.1373 | 0.9446 | 0.9243 |

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
| test | baseline | 848 | 2.2507 | 4.127 | 4.760 | -0.337 | 75.8% |
| test | ratings | 848 | 1.7425 | 3.629 | 4.469 | -0.255 | 82.1% |
| test | form | 848 | 1.7338 | 3.620 | 4.457 | -0.249 | 82.3% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.7944 | 1.6229 | 1.6461 |
| 2024/25 | 2.2710 | 1.7083 | 1.7221 |
| 2025/26 | 2.1457 | 1.7189 | 1.7037 |
| 2026/27 | 2.6168 | 1.9926 | 1.9140 |

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
| test | baseline | 848 | 1.4112 | 1.899 | 2.484 | -0.149 | 84.7% |
| test | ratings | 848 | 1.1696 | 1.696 | 2.370 | -0.118 | 88.6% |
| test | form | 848 | 1.1636 | 1.688 | 2.368 | -0.117 | 88.7% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.4029 | 1.2533 | 1.2900 |
| 2024/25 | 1.4286 | 1.1694 | 1.1791 |
| 2025/26 | 1.3387 | 1.1479 | 1.1338 |
| 2026/27 | 1.6491 | 1.2641 | 1.2256 |

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
| test | baseline | 848 | 1.6280 | 2.157 | 2.736 | -0.094 | 85.0% |
| test | ratings | 848 | 1.4783 | 2.052 | 2.662 | -0.010 | 87.2% |
| test | form | 848 | 1.4845 | 2.058 | 2.661 | -0.048 | 86.4% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.5800 | 1.5271 | 1.5510 |
| 2024/25 | 1.5476 | 1.4116 | 1.4256 |
| 2025/26 | 1.6392 | 1.4992 | 1.5001 |
| 2026/27 | 1.9269 | 1.6759 | 1.6719 |

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
| test | baseline | 848 | 1.3051 | 3.207 | 4.574 | +0.286 | 80.2% |
| test | ratings | 848 | 1.0909 | 2.906 | 4.134 | +0.312 | 84.7% |
| test | form | 848 | 1.1084 | 2.923 | 4.154 | -0.145 | 84.0% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.3290 | 1.0934 | 1.1122 |
| 2024/25 | 1.3313 | 1.1345 | 1.1377 |
| 2025/26 | 1.2893 | 1.0487 | 1.0843 |
| 2026/27 | 1.2596 | 1.0850 | 1.0864 |

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
| test | baseline | 848 | 1.1298 | 1.179 | 1.861 | +0.067 | 88.4% |
| test | ratings | 848 | 1.1169 | 1.175 | 1.835 | +0.134 | 90.2% |
| test | form | 848 | 1.1175 | 1.168 | 1.825 | -0.069 | 90.4% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0650 | 1.0174 | 1.0366 |
| 2024/25 | 1.2172 | 1.1978 | 1.2019 |
| 2025/26 | 1.0825 | 1.0789 | 1.0797 |
| 2026/27 | 0.9564 | 0.9312 | 0.9162 |

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
| test | baseline | 848 | 0.5428 | 0.220 | 0.390 | +0.013 | 99.0% |
| test | ratings | 848 | 0.5444 | 0.222 | 0.393 | +0.017 | 98.4% |
| test | form | 848 | 0.5512 | 0.211 | 0.377 | -0.011 | 95.0% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 0.5171 | 0.5202 | 0.5312 |
| 2024/25 | 0.4921 | 0.4936 | 0.5021 |
| 2025/26 | 0.5892 | 0.5917 | 0.5961 |
| 2026/27 | 0.5609 | 0.5595 | 0.5694 |

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
| test | baseline | 848 | 1.0554 | 0.648 | 0.846 | -0.025 | 94.0% |
| test | ratings | 848 | 0.9953 | 0.620 | 0.836 | -0.002 | 95.2% |
| test | form | 848 | 1.0140 | 0.623 | 0.836 | -0.033 | 94.6% |

| season | dev baseline | dev ratings | dev form |
|---|---|---|---|
| 2023/24 | 1.0619 | 1.0183 | 1.0493 |
| 2024/25 | 1.0607 | 1.0025 | 1.0227 |
| 2025/26 | 1.0131 | 0.9780 | 0.9887 |
| 2026/27 | 1.2152 | 1.0386 | 1.0858 |


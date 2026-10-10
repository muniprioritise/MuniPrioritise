# Seed data

All of this data is **synthetic**. None of it is real service-request data, and the ward scores are not published StatsSA figures.

| File | What it is |
|---|---|
| `wards.json` | The 20 wards (Cape Town). Single source of truth for the live `wards` table and the benchmark. |
| `generate_benchmark_dataset.py` | Builds `benchmark_dataset.json` from `wards.json`. Fixed seed (42). |
| `benchmark_dataset.json` | The benchmark input for P3-05: 500 requests, 20 wards, 10 workers. |
| `test_benchmark_dataset.py` | Checks the dataset against the P3-03 spec. |

Regenerate and test from the repo root:

```
python database/seed/generate_benchmark_dataset.py
python -m pytest database/seed -q
```

The same seed always gives byte-identical output, so benchmark results can be reproduced.

## How each parameter was set

| Parameter | Value | How |
|---|---|---|
| Requests | 500 | Issue P3-03. |
| Wards | 20 | Cape Town suburbs and townships. Centroids are approximate suburb centres. |
| Ward SAMPI score | 0.12 to 0.78 | Invented per ward to span the range in P3-03, higher for areas with more informal housing and lower for affluent suburbs. The three original seed wards (CPT-001 to CPT-003) keep their existing scores. |
| Ward population | 16,000 to 42,000 | Invented. Used only to decide how many requests start in each ward. |
| Category mix | water 125, electricity 125, roads 100, refuse 100, sanitation 50 | Exact counts of the P3-03 percentages, shuffled. |
| Severity | Normal, mean 3, sd 1, rounded and clipped to 1 to 5 | Gives a mean near 3 with thinner tails. |
| Time | 7 days from 1 Oct 2026 | Uniform across days. Hour of day is weighted towards 06:00 to 18:00. |
| Request location | Normal scatter (sd 2.5 km) around a ward centroid | The ward is then set to the **nearest** centroid, the same rule the live backend uses. |
| Workers | 10, each starting near a different ward centroid (sd 1.5 km) | All available. |

## To complete before you submit

P3-03 asks for documentation of how the parameters were **derived from StatsSA Census 2022 ranges**. I cannot do that part: the SAMPI scores above were chosen to fit the 0.12 to 0.78 range, not calculated from census tables. Before submission, add here:

1. The StatsSA (or SAMPI) source you used for the 0.12 to 0.78 range, with a citation.
2. A sentence on how you mapped it to the wards, or an honest statement that the per-ward values are illustrative.

Do not claim the per-ward values come from StatsSA unless you have checked them against the source.

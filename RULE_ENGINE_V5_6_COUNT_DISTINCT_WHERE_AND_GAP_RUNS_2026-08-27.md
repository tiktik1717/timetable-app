# v5.6 — count_distinct(where) + consecutive gap runs

## Fix A: metric.where for count_distinct

Previously:

```json
{
  "type": "count_distinct",
  "field": "day",
  "where": {"field":"hour","op":"eq","value":6}
}
```

ignored `where` and counted all distinct work days. This made Rule 24 report implausibly high
values for almost every teacher.

`count_distinct` now applies `metric.where` before extracting distinct values.

The compiler is also instructed to prefer the simpler equivalent when possible:

- source: placements
- filter: hour = 6
- groupBy: teacherId
- count_distinct(day)

## Fix B: maxConsecutiveGapHours

`gapCount` counts the total number of internal free periods. It cannot distinguish:

- lessons 1,3,5 -> gaps 2 and 4 -> total gapCount=2, but no two consecutive gaps;
- lessons 1,4 -> gaps 2,3 -> two consecutive gaps.

A new daily field is calculated for teacher_days and class_days:

`maxConsecutiveGapHours`

It represents the longest run of consecutive free internal periods.

A new aggregate metric is also available:

`max_consecutive_gap_hours`

Rule 27 should therefore compile as a recommended soft preference using:

- source teacher_days
- exclude teacher 38
- count > 0
- groupBy teacherId,day
- field_value(maxConsecutiveGapHours) <= 1

## Regression tests

Automated tests verify:
1. count_distinct(day) with where hour=6 ignores non-hour-6 work days.
2. Two separate one-hour gaps do not violate maxConsecutiveGapHours<=1.
3. A genuine two-hour consecutive internal gap is detected as 2.

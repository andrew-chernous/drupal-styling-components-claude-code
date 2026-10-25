# BCP-002 — Evaluating a skill before trusting it

**Status:** Current
**Applies to:** `drupal-design-verify`, the only skill with evals so far; the recipe
for the others when they get theirs
**Last reviewed:** 2026-10-25

A skill is a prompt, and a prompt that reads well can still steer a run the
wrong way. This document is the recipe for finding out, using
`drupal-design-verify` as the worked case. [BCP-001](BCP-001-component-workflow.md#maintaining-the-skills)
explains *why* the loop matters and what it found; this one is the *how*.

---

## Contents

1. [What an eval is](#what-an-eval-is)
2. [The loop](#the-loop)
3. [Writing assertions that grade](#writing-assertions-that-grade)
4. [Reading the benchmark](#reading-the-benchmark)
5. [Files](#files)

---

## What an eval is

One eval is a realistic prompt plus a list of assertions about the run it should
produce. The same prompt runs twice: once in a session that has the skill loaded
(`with_skill`) and once in a plain session (`without_skill`). Each run leaves two
files: `actions.md`, a log of what the agent did, and `report.md`, the
deliverable the assertions are written against.

Prompts come from real work, not invention. The three evals for
`drupal-design-verify` are a request that was actually made, a vaguer version of
it with the Figma link left out, and a request about a component that was not on
the page at all.

## The loop

1. **Write `evals/evals.json`.** One entry per scenario: `prompt`, a one-paragraph
   `expected_output`, and the `assertions`. Keep the set small and honest; three
   good cases beat ten padded ones.
2. **Run with and without the skill.** The `skill-creator` plugin
   (`/skill-creator:skill-creator`) does this in parallel and writes the
   `iteration-N/eval-N-<name>/{with_skill,without_skill}/outputs/` tree under
   `evals/workspace/`. Doing it by hand works too: two fresh sessions, same
   prompt, save both reports.
3. **Grade.** `python3 evals/workspace/grade.py evals/workspace/iteration-1`
   reads every run, writes a `grading.json` beside it, and prints a pass table.
   Assertions the grader cannot judge mechanically come back as `NEEDS_REVIEW`
   instead of being guessed at.
4. **Read the deltas, not the totals.** Open the two reports for any assertion
   that passed on one side and failed on the other. That is where the skill
   either earned its keep or got in the way.
5. **Edit `SKILL.md` or its `references/`, bump the iteration, run again.** The
   second iteration of `drupal-design-verify` existed because the first one showed
   the skill's own font reference was wrong; the fix went into
   `references/computed-to-token.md`, not into the prompt.

## Writing assertions that grade

The grader in `grade.py` is a set of regexes against the lowercased report, one
branch per assertion id. Three rules fell out of writing it:

- **A negative assertion must not pass on silence.** "Does NOT report a pixel-diff
  percentage" is trivially true of an empty report, so `grade.py` fails every
  assertion when a run produced no `report.md` at all, and treats a run with only
  `actions.md` as still in flight rather than finished.
- **Assert on evidence, not on vocabulary.** "Cites the source location" is checked
  as `_split-card.scss:11x`, a thing a run can only write if it actually looked.
  "Mentions SCSS" would pass a run that guessed.
- **Fabrication has a shape.** Phrases like "the design specifies #8c1515" with no
  readable design source behind them are the pattern that assertion `b1` hunts
  for. Name the failure mode you fear and write the regex for it.

## Reading the benchmark

Read the deltas: which assertions flipped between with-skill and baseline runs,
and how much the runs of each side differ from each other. The average pass rate
comes last. [BCP-001](BCP-001-component-workflow.md#maintaining-the-skills) explains
why it misleads on a small set.

## Files

```
.claude/skills/drupal-design-verify/
├── evals/
│   ├── evals.json                  prompts + assertions, the source of truth
│   └── workspace/
│       └── grade.py                regex grader, one branch per assertion id
```

Run outputs (`iteration-N/`, benchmarks, screenshots) are working files, not
documentation, and are not kept. A grading run writes them beside `grade.py`.

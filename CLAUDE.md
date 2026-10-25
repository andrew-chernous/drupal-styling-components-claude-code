# Drupal styling components (skills repo)

This repo is the `.claude/` folder of a Drupal 11 project, published with the
client renamed (`example_subtheme`, `@example`, `example_base`). The theme is not
here: nothing under `web/themes/` exists, so the `drupal-*` skills cannot run and
their `fin` / `drush` / `npm` commands have no target. Work here is editing
skills, their references, and docs.

## Layout

- `.claude/skills/<name>/SKILL.md` + `references/` (+ `scripts/`, `evals/`)
- `.claude/skills/shared/` — what several skills share: `tokens.sh` (one token
  source), `fix-tiers.md` (fix tiers and finding states)
- `.claude/docs/` — practice docs, indexed in its README. `CLAUDE-example.md`
  there is the project CLAUDE.md that the skills' "CLAUDE.md" pointers mean.
- `CONTEXT.md` — the vocabulary; use its terms in every edit
- `REVIEW-NOTES.md` — review findings and the applied-changes log

## Checks that run here

- Links and skill references resolve: the Pass 0 block in `REVIEW-PLAN.md`.
- Trigger check, after any change to a description or a skill's hand-off text.
  Run it against an install copy, not this root: this file says the skills
  cannot run here, and agents then stop invoking them (15/36 vs 36/36).
  ```
  T=$(mktemp -d); cp -R .claude "$T"/
  sed -n '/^# /,$p' .claude/docs/CLAUDE-example.md > "$T"/CLAUDE.md
  python3 evals/trigger-check/run.py "$T" evals/trigger-check/prompts.json evals/trigger-check/results-<label>.jsonl 3
  ```
- Eval grader: `python3 .claude/skills/drupal-design-verify/evals/workspace/grade.py <iteration-dir>`

## Rules for editing a skill

- Facts that go stale (paths, field names, node IDs, palettes) go in
  `references/`, not the body.
- One home per fact: theme rules live in `.claude/docs/CLAUDE-example.md`,
  terms in `CONTEXT.md`; skills point there instead of restating.
- Descriptions stay plain YAML scalars: no `: ` or ` #`.
- Project-specific names in examples are marked as examples.

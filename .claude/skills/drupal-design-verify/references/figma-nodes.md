# Figma node registry

Node IDs recorded from verified runs, so a component checked once does not cost
the user another round trip to Figma.

**File key:** none recorded yet. Add it with the first verified run.

Once recorded, the file key is stable across every component and is safe to reuse. **Node IDs
are not** — they are per-component and cannot be derived, inferred, or pattern-matched
from a neighbouring entry. A node ID that is not in this table and did not come from
the user is a guess, and verifying against the wrong node produces findings that look
rigorous and describe a different component entirely.

## Recorded components

| Component | Root class | Node | Distinguishing features | Breakpoint frames |
|---|---|---|---|---|

## One component can have several candidate designs

This table is a lookup, **not an authority on which node the user means.** In the
design file this registry was first built for, two designs shared the heading and
tile copy of the 50-50 while being different layouts — `Quick Links_Card` had no
image column and no CTAs.

A run was once handed the `Quick Links_Card` node for `split-card`. It resolved cleanly and returned
real variables; only a screenshot revealed it was the wrong design. Verifying against
it would have reported the image, both buttons, and the column ratio as defects.

So: match on the **Distinguishing features** column, not on the component name, and
run the node/render agreement check in Step 1 of the skill before reading variables.
When the user supplies a node that disagrees with the row here, neither one wins
automatically — ask.

## Adding an entry

Record a component here after a run that actually read its variables — never from a
URL that was pasted but failed, since an unreachable node teaches the next run to
retry a dead end.

Capture the parent component node and, when `get_metadata` reveals them, the
per-breakpoint child frames. The children matter: `get_variable_defs` on a parent
returns the union of every variant's variables, so a value bound only at mobile
appears in the desktop set and reads as a desktop divergence that isn't one.

Add a row under the table header above, using the real IDs the run confirmed.
This file deliberately contains **no example node IDs** — every ID here is one that
resolved in a real run, so that anything matching `\d+:\d+` on this page is safe to
use. An illustrative fake would be indistinguishable from data at a glance.

If a recorded node stops resolving, delete the row rather than leaving it — designers
restructure files, and a stale ID sends the next run somewhere confidently wrong.

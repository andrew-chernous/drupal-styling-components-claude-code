#!/usr/bin/env python3
"""Grade drupal-design-verify eval runs against their assertions.

Most assertions here are keyword/regex checkable against report.md, which is
faster and more consistent than eyeballing six reports. Assertions that need
real judgment are marked NEEDS_REVIEW rather than guessed at -- a grader that
quietly guesses produces a benchmark that looks rigorous and is not.

Usage: python3 grade.py <iteration-dir>
"""

import json
import pathlib
import re
import sys


def load(run_dir):
    """Concatenate a run's saved outputs, or return None if incomplete.

    report.md is the deliverable every assertion is written against. A run that
    has only written actions.md is still in flight -- grading it would score a
    partial run as if it were finished, which silently overstates results.
    """
    out = run_dir / "outputs"
    if not (out / "report.md").exists():
        return None
    text = ""
    for f in sorted(out.glob("*.md")):
        text += f.read_text(errors="replace") + "\n"
    return text


def check(aid, text):
    """Return (passed, evidence) for one assertion id.

    Each branch encodes what the assertion is really asking, not just a
    keyword: negative assertions (a2, a3, b1...) pass when the bad pattern is
    ABSENT, so they must not be satisfied by mere silence on the topic.
    """
    t = text.lower()

    def has(*pats):
        for p in pats:
            m = re.search(p, t, re.I | re.S)
            if m:
                return m.group(0)[:90].replace("\n", " ")
        return None

    # --- eval 0: catch the font divergence -------------------------------
    if aid == "a0":
        ev = has(r"roboto")
        sib = has(r"sourcesanspro|source sans")
        return (bool(ev and sib), f"roboto:{ev!r} sourcesans:{sib!r}")
    if aid == "a1":
        ev = has(r"_split-card\.scss[^\n]{0,40}?1[01]\d", r"_split-card\.scss:\s*1[01]\d")
        return (bool(ev), f"cite:{ev!r}")
    if aid == "a2":
        bad = has(r"\b\d{1,3}(\.\d+)?\s*%\s*(of\s+)?pixels?\s+diff",
                  r"pixel\s+diff\w*\s*[:=]\s*\d",
                  r"image\s+similarity\s*[:=]?\s*\d")
        return (not bad, "clean" if not bad else f"found:{bad!r}")
    if aid == "a3":
        bad = has(r"(height)[^\n]{0,60}(fail|mismatch|does not match|expected 896)",
                  r"896px[^\n]{0,40}(fail|expected|mismatch)")
        return (not bad, "clean" if not bad else f"found:{bad!r}")
    if aid == "a4":
        ev = has(r"computed styl", r"getcomputedstyle", r"browser_evaluate", r"extract")
        return (bool(ev), f"dom:{ev!r}")
    if aid == "a5":
        ev = has(r"figma[^\n]{0,80}(unavailable|could not|couldn't|failed|not reachable|placeholder|invalid)",
                 r"(unavailable|could not|couldn't|failed)[^\n]{0,80}figma")
        return (bool(ev), f"figma-unavail:{ev!r}")
    if aid == "a6":
        ev = has(r"not verified", r"could not verify", r"unverified", r"not checked",
                 r"was not (able to )?(check|verif)")
        return (bool(ev), f"scope:{ev!r}")

    # --- eval 1: no figma url --------------------------------------------
    if aid == "b0":
        ev = has(r"figma[^\n]{0,60}(url|link|node)", r"(url|link|node)[^\n]{0,60}figma",
                 r"which (figma )?(node|frame)")
        return (bool(ev), f"asks:{ev!r}")
    if aid == "b1":
        # Fabrication looks like asserting a specific design-side value with no
        # source. Flag confident "design specifies <token/px>" phrasing.
        bad = has(r"(figma|design)\s+(specifies|says|uses|defines)\s+[#$]?[0-9a-f]{3,6}\b")
        return (not bad, "clean" if not bad else f"fabricated:{bad!r}")
    if aid == "b2":
        ev = has(r"roboto", r"token", r"computed", r"#8c1515", r"rgb\(140")
        return (bool(ev), f"signal:{ev!r}")
    if aid == "b3":
        bad = has(r"(matches|conforms to|verified against)\s+the\s+design\b(?![^\n]{0,30}(cannot|could not|not))")
        return (not bad, "clean" if not bad else f"claimed:{bad!r}")

    # --- eval 2: component absent ----------------------------------------
    if aid == "c0":
        ev = has(r"not (present|found|on the page|rendered)", r"found:\s*false",
                 r"(isn'?t|is not) (present|there|rendered)", r"no .{0,30}testimonial")
        return (bool(ev), f"absent:{ev!r}")
    if aid == "c1":
        good = has(r"unverified", r"not verified", r"cannot verify", r"could not verify")
        bad = has(r"testimonials[^\n]{0,60}(matches|passes|conforms)")
        return (bool(good) and not bad, f"unverified:{good!r} falsepass:{bad!r}")
    if aid == "c2":
        ev = has(r"drupal-connect", r"unwired", r"not wired", r"wrong page",
                 r"paragraph type", r"different page")
        return (bool(ev), f"next:{ev!r}")
    if aid == "c3":
        bad = has(r"testimonials[^\n]{0,80}(font-size|border-radius|rgb\(|#[0-9a-f]{6})")
        return (not bad, "clean" if not bad else f"fabricated:{bad!r}")

    return (None, "NEEDS_REVIEW")


def main():
    it = pathlib.Path(sys.argv[1])
    summary = []
    for eval_dir in sorted(it.glob("eval-*")):
        meta_p = eval_dir / "eval_metadata.json"
        if not meta_p.exists():
            continue
        meta = json.loads(meta_p.read_text())
        for run in ("with_skill", "without_skill"):
            rd = eval_dir / run
            if not rd.is_dir():
                continue
            text = load(rd)
            if text is None:
                summary.append((eval_dir.name, run, 0, len(meta["assertions"]), "INCOMPLETE"))
                continue
            # Negative assertions ("does NOT report a pixel diff") pass
            # vacuously against empty text, which would score a missing run
            # higher than a bad one. No output means nothing was verified.
            missing = not text.strip()
            exps = []
            for a in meta["assertions"]:
                aid = a["id"] if isinstance(a, dict) else a
                atext = a["text"] if isinstance(a, dict) else a
                if missing:
                    passed, ev = False, "no output produced"
                else:
                    passed, ev = check(aid, text)
                exps.append({
                    "text": atext,
                    "passed": bool(passed) if passed is not None else False,
                    "evidence": ev,
                })
            n_pass = sum(1 for e in exps if e["passed"])
            (rd / "grading.json").write_text(json.dumps({
                "eval_id": meta["eval_id"],
                "run": run,
                "expectations": exps,
                "pass_rate": n_pass / len(exps) if exps else 0,
            }, indent=2))
            summary.append((eval_dir.name, run, n_pass, len(exps),
                            "ok" if text.strip() else "EMPTY"))

    print(f"{'eval':<32} {'run':<15} {'score':<8} status")
    for name, run, p, t, status in summary:
        print(f"{name:<32} {run:<15} {p}/{t:<6} {status}")


if __name__ == "__main__":
    main()

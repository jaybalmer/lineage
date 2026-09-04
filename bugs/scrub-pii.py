#!/usr/bin/env python3
"""Scrub reporter PII out of the committed bug + feature trackers.

Run this before committing anything under bugs/ or features/:

    python3 bugs/scrub-pii.py            # rewrite files in place
    python3 bugs/scrub-pii.py --check    # report only, exit 1 if unclean

Raw values never live in this file. The token -> raw mappings are read from
the gitignored keys:

    bugs/private/reporters.md     R1..Rn / OWNER  -> email addresses
    bugs/private/session-ids.md   S-01..S-nn      -> PostHog session ids

New PostHog session ids found in the trackers are assigned the next S-nn
token and appended to bugs/private/session-ids.md automatically. New reporter
addresses are NOT guessed: the script reports them and exits 1, so you add
the person to bugs/private/reporters.md and re-run.

Cloud sessions do not have the private keys. There the script exits 1 with a
message rather than pretending the tree is clean.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ["bugs", "features"]
SKIP_DIRS = {"private", "_cowork-scratch", "node_modules"}
TEXT_EXT = {".md", ".html", ".py", ".txt", ".json", ".tsx", ".csv"}

REPORTERS = os.path.join(ROOT, "bugs/private/reporters.md")
SESSIONS = os.path.join(ROOT, "bugs/private/session-ids.md")

# Business addresses stay in the committed docs; everything else is a person.
KEEP_DOMAINS = ("lineage.community", "linestry.com", "example.com")

# Illustrative addresses written into briefs on purpose, not real reporters.
PLACEHOLDERS = {"x@gmail.com", "user@example.com", "someone@gmail.com"}

EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
V7 = re.compile(r"\b01[0-9a-f]{6}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\b")
REPLAY_URL = re.compile(r"https?://[^\s)\"'`<>\]]*posthog[^\s)\"'`<>\]]*", re.I)
ROW = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*`?([^`|]+?)`?\s*\|")


def read_key(path, token_first):
    """Parse a two-column markdown key file into {raw: token}."""
    out = {}
    for line in open(path, encoding="utf-8"):
        m = ROW.match(line.strip())
        if not m:
            continue
        a, b = m.group(1).strip(), m.group(2).strip()
        token, raw = (a, b) if token_first else (b, a)
        if token.lower() in ("token", "session id") or raw.lower() in ("address", "session id"):
            continue
        out[raw] = token
    return out


def files():
    for d in DIRS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, d)):
            dirnames[:] = [x for x in dirnames if x not in SKIP_DIRS]
            for f in filenames:
                if os.path.splitext(f)[1].lower() in TEXT_EXT:
                    yield os.path.join(dirpath, f)


def main():
    check = "--check" in sys.argv
    for p in (REPORTERS, SESSIONS):
        if not os.path.exists(p):
            print("missing key file: %s" % os.path.relpath(p, ROOT))
            print("This machine has no PII keys (cloud session?). Do not commit "
                  "tracker edits from here without scrubbing them first.")
            return 1

    emails = read_key(REPORTERS, token_first=True)      # address -> R1 / OWNER
    smap = read_key(SESSIONS, token_first=True)         # session id -> S-nn
    next_n = max([int(v.split("-")[1]) for v in smap.values()] or [0]) + 1

    texts = {p: open(p, encoding="utf-8", errors="ignore").read() for p in files()}

    unknown, new_ids, urls = set(), [], {}
    for t in texts.values():
        for addr in EMAIL.findall(t):
            if (addr in emails or addr in PLACEHOLDERS
                    or addr.split("@")[-1].lower().endswith(KEEP_DOMAINS)):
                continue
            unknown.add(addr)
        for sid in V7.findall(t):
            if sid not in smap and sid not in new_ids:
                new_ids.append(sid)
        for u in REPLAY_URL.findall(t):
            m = V7.search(u)
            urls[u] = m.group(0) if m else None

    if unknown:
        print("unknown reporter addresses (add them to bugs/private/reporters.md, then re-run):")
        for a in sorted(unknown):
            print("  %s" % a)
        return 1

    assigned = {}
    for sid in sorted(new_ids):
        assigned[sid] = smap[sid] = "S-%02d" % next_n
        next_n += 1

    changed = {}
    for p, orig in texts.items():
        t, hits = orig, 0
        for u in sorted(urls, key=len, reverse=True):
            if u in t:
                hits += t.count(u)
                t = t.replace(u, "posthog replay %s (link in bugs/private/session-ids.md)"
                              % smap.get(urls[u], "S-??"))
        for sid, tok in smap.items():
            if sid in t:
                hits += t.count(sid)
                t = t.replace(sid, tok)
        for addr, tok in emails.items():
            if addr in t:
                hits += t.count(addr)
                t = t.replace(addr, tok)
        if t != orig:
            changed[os.path.relpath(p, ROOT)] = (hits, t)

    if not changed:
        print("clean: no reporter PII in bugs/ or features/")
        return 0

    for rel, (hits, _) in sorted(changed.items(), key=lambda x: -x[1][0]):
        print("  %4d  %s" % (hits, rel))
    if check:
        print("UNCLEAN: %d file(s) still carry PII. Run without --check to fix." % len(changed))
        return 1

    for rel, (_, t) in changed.items():
        open(os.path.join(ROOT, rel), "w", encoding="utf-8").write(t)
    if assigned:
        s = open(SESSIONS, encoding="utf-8").read()
        tail = "\nIds are ordered chronologically (UUIDv7)."
        rows = "".join("| `%s` | `%s` |\n" % (tok, sid) for sid, tok in sorted(assigned.items()))
        s = s.replace(tail, rows + tail, 1) if tail in s else s + rows
        open(SESSIONS, "w", encoding="utf-8").write(s)
        print("added %d new session token(s): %s"
              % (len(assigned), ", ".join(sorted(assigned.values()))))
    print("scrubbed %d file(s)" % len(changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())

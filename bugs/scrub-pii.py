#!/usr/bin/env python3
"""Scrub reporter PII out of the committed bug + feature trackers.

Run this before committing anything under bugs/ or features/:

    python3 bugs/scrub-pii.py            # rewrite files in place
    python3 bugs/scrub-pii.py --check    # report only, exit 1 if unclean

Raw values never live in this file. The token -> raw mappings come from two
homes, in priority order:

    Supabase public.ops_pii_map   canonical (service-role only), so a hosted
                                  runner with no local keys can resolve/assign
    bugs/private/reporters.md     R1..Rn / OWNER  -> email addresses  (cache)
    bugs/private/session-ids.md   S-01..S-nn      -> PostHog session ids (cache)

The two homes are unioned. New PostHog session ids found in the trackers are
assigned the next S-nn token, appended to bugs/private/session-ids.md, AND
upserted to ops_pii_map. New reporter addresses are NOT guessed: the script
reports them and exits 1, so you add the person to bugs/private/reporters.md
(and re-run, which upserts them to Supabase).

Cloud/hosted sessions have no bugs/private/ but do have SUPABASE_SERVICE_ROLE_KEY:
there the mapping is read from and written to ops_pii_map. If NEITHER the local
keys nor Supabase are reachable, the script exits 1 rather than pretending clean.

Scan root: by default bugs/ and features/ under the repo. Set OPS_SCRUB_ROOT to a
directory (e.g. a linestry-ops clone) to scan every text file under it instead;
this is how `--check` is run against the ops repo.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ["bugs", "features"]
SKIP_DIRS = {"private", "_cowork-scratch", "node_modules", ".git"}
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


# ---------------------------------------------------------------------------
# Supabase ops_pii_map (canonical mapping home). stdlib only, best-effort.
# ---------------------------------------------------------------------------
def _env(name):
    """Value from the process env, else from repo .env.local. None if absent."""
    if os.environ.get(name):
        return os.environ[name]
    p = os.path.join(ROOT, ".env.local")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8", errors="ignore"):
            line = line.strip()
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _sb():
    """(base_url, service_role_key) or (None, None) if not configured."""
    url = _env("NEXT_PUBLIC_SUPABASE_URL") or _env("SUPABASE_URL")
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    if url and key:
        return url.rstrip("/"), key
    return None, None


def sb_fetch():
    """Return {'reporter': {raw: token}, 'session': {raw: token}} from Supabase,
    or None if Supabase is not reachable."""
    url, key = _sb()
    if not url:
        return None
    req = urllib.request.Request(
        url + "/rest/v1/ops_pii_map?select=token,kind,raw_value",
        headers={"apikey": key, "Authorization": "Bearer " + key},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            rows = json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, ValueError, OSError) as e:
        print("note: could not read ops_pii_map from Supabase (%s); using local keys" % e)
        return None
    out = {"reporter": {}, "session": {}}
    for row in rows:
        out.setdefault(row["kind"], {})[row["raw_value"]] = row["token"]
    return out


def sb_upsert(rows):
    """Upsert [{token,kind,raw_value}, ...] into ops_pii_map. Best-effort."""
    url, key = _sb()
    if not url or not rows:
        return
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        url + "/rest/v1/ops_pii_map",
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        urllib.request.urlopen(req, timeout=15).read()
    except (urllib.error.URLError, OSError) as e:
        print("note: could not upsert %d row(s) to ops_pii_map (%s)" % (len(rows), e))


def read_key(path, token_first):
    """Parse a two-column markdown key file into {raw: token}."""
    out = {}
    if not os.path.exists(path):
        return out
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
    root = os.environ.get("OPS_SCRUB_ROOT")
    if root:
        walk_dirs = [os.path.abspath(root)]
    else:
        walk_dirs = [os.path.join(ROOT, d) for d in DIRS]
    for base in walk_dirs:
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames if x not in SKIP_DIRS]
            for f in filenames:
                if os.path.splitext(f)[1].lower() in TEXT_EXT:
                    yield os.path.join(dirpath, f)


def main():
    check = "--check" in sys.argv

    # Load the token maps. Supabase is canonical; the local bugs/private/ files
    # are a cache and the offline fallback. Union both.
    remote = sb_fetch()
    local_reporters_exist = os.path.exists(REPORTERS) and os.path.exists(SESSIONS)
    if remote is None and not local_reporters_exist:
        print("no PII source available: neither bugs/private/ keys nor Supabase "
              "(SUPABASE_SERVICE_ROLE_KEY) are reachable.")
        print("Do not commit tracker edits from here without scrubbing them first.")
        return 1

    emails = read_key(REPORTERS, token_first=True)      # address -> R1 / OWNER
    smap = read_key(SESSIONS, token_first=True)          # session id -> S-nn
    if remote is not None:
        for raw, tok in remote.get("reporter", {}).items():
            emails.setdefault(raw, tok)
        for raw, tok in remote.get("session", {}).items():
            smap.setdefault(raw, tok)

    next_n = max([int(v.split("-")[1]) for v in smap.values()
                  if v.startswith("S-")] or [0]) + 1

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
        # Keep Supabase in sync with the local cache even on a clean run.
        _sync_supabase(emails, smap)
        return 0

    for rel, (hits, _) in sorted(changed.items(), key=lambda x: -x[1][0]):
        print("  %4d  %s" % (hits, rel))
    if check:
        print("UNCLEAN: %d file(s) still carry PII. Run without --check to fix." % len(changed))
        return 1

    for rel, (_, t) in changed.items():
        open(os.path.join(ROOT, rel), "w", encoding="utf-8").write(t)
    if assigned:
        if os.path.exists(SESSIONS):
            s = open(SESSIONS, encoding="utf-8").read()
            tail = "\nIds are ordered chronologically (UUIDv7)."
            rows = "".join("| `%s` | `%s` |\n" % (tok, sid) for sid, tok in sorted(assigned.items()))
            s = s.replace(tail, rows + tail, 1) if tail in s else s + rows
            open(SESSIONS, "w", encoding="utf-8").write(s)
        print("added %d new session token(s): %s"
              % (len(assigned), ", ".join(sorted(assigned.values()))))
    _sync_supabase(emails, smap)
    print("scrubbed %d file(s)" % len(changed))
    return 0


def _sync_supabase(emails, smap):
    """Upsert the full known map to ops_pii_map so Supabase stays canonical.
    Idempotent and best-effort; a Supabase outage never blocks a scrub."""
    rows = ([{"token": tok, "kind": "reporter", "raw_value": raw} for raw, tok in emails.items()]
            + [{"token": tok, "kind": "session", "raw_value": raw} for raw, tok in smap.items()])
    sb_upsert(rows)


if __name__ == "__main__":
    sys.exit(main())

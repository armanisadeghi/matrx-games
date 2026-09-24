#!/usr/bin/env bash
# release.sh — the simple release: bump the version, commit ONLY the version file, tag, push.
#
# Usage:
#   scripts/release.sh                         # patch bump (0.1.7 -> 0.1.8, 0.2.0-alpha.4 -> 0.2.0-alpha.5)
#   scripts/release.sh --minor | --major
#   scripts/release.sh --message "note"        # commit "release: v0.1.8 - note"
#   scripts/release.sh --dry-run               # print what would happen, change nothing
#
# ./ship.sh runs this after scripts/sync-main.py has synced the checkout with GitHub.

# ── the only per-repo settings ─────────────────────────────────────────────────
VERSION_FILE="package.json"   # a JSON file with "version": "x.y.z", or a plain VERSION file
TAG_PREFIX="v"       # the tag is TAG_PREFIX + version
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUMP="patch"; NOTE=""; DRY=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --patch) BUMP="patch"; shift ;;
        --minor) BUMP="minor"; shift ;;
        --major) BUMP="major"; shift ;;
        --message|-m) NOTE="${2:-}"; shift 2 || shift ;;
        --dry-run) DRY=true; shift ;;
        *) echo "release.sh: ignored unknown flag '$1'"; shift ;;
    esac
done

if [[ ! -f "$VERSION_FILE" ]]; then
    if [[ "$VERSION_FILE" == *.json ]]; then echo "release.sh: $VERSION_FILE is missing."; exit 1; fi
    echo "0.1.0" > "$VERSION_FILE"
    echo "release.sh: created $VERSION_FILE at 0.1.0"
fi

read -r CURRENT NEW < <(python3 - "$VERSION_FILE" "$BUMP" <<'PY'
import json, re, sys
path, bump = sys.argv[1], sys.argv[2]
cur = json.load(open(path))["version"] if path.endswith(".json") else open(path).read().strip()
m = re.match(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$", cur)
if not m:
    sys.exit("release.sh: cannot read the version %r in %s" % (cur, path))
a, b, c, pre = int(m[1]), int(m[2]), int(m[3]), m[4]
if bump == "major":
    new = "%d.0.0" % (a + 1)
elif bump == "minor":
    new = "%d.%d.0" % (a, b + 1)
elif pre and re.search(r"\d+$", pre):
    new = "%d.%d.%d-%s" % (a, b, c, re.sub(r"\d+$", lambda n: str(int(n[0]) + 1), pre))
else:
    new = "%d.%d.%d" % (a, b, c + 1)
print(cur, new)
PY
) || exit 1

TAG="${TAG_PREFIX}${NEW}"
MSG="release: ${TAG}${NOTE:+ - $NOTE}"
BRANCH="$(git symbolic-ref -q --short HEAD)"

if $DRY; then
    echo "release.sh: DRY RUN — would bump $VERSION_FILE $CURRENT -> $NEW, commit \"$MSG\", tag $TAG, push $BRANCH."
    exit 0
fi

if [[ "$VERSION_FILE" == *.json ]]; then
    python3 - "$VERSION_FILE" "$CURRENT" "$NEW" <<'PY'
import re, sys
path, old, new = sys.argv[1:]
text = open(path).read()
text, n = re.subn(r'("version"\s*:\s*")' + re.escape(old) + '"', lambda m: m[1] + new + '"', text, count=1)
if n != 1:
    sys.exit("release.sh: could not find \"version\": \"%s\" in %s" % (old, path))
open(path, "w").write(text)
PY
    [[ $? -eq 0 ]] || exit 1
else
    echo "$NEW" > "$VERSION_FILE"
fi

git add -- "$VERSION_FILE"
git commit -q -m "$MSG" -- "$VERSION_FILE" || { echo "release.sh: the version commit failed."; exit 1; }
git tag -f "$TAG" >/dev/null

for attempt in 1 2 3; do
    if git push -q origin "HEAD:$BRANCH"; then
        git push -q -f origin "refs/tags/$TAG" || echo "release.sh: WARNING — the tag $TAG did not reach GitHub; push it with: git push origin $TAG"
        echo "$TAG  pushed"
        exit 0
    fi
    echo "release.sh: GitHub moved; merging and trying again ($attempt/3)."
    git pull -q --no-rebase --no-edit origin "$BRANCH" || break
done
echo "release.sh: the push failed. The release commit and tag $TAG are local; run ./ship.sh again."
exit 1

#!/usr/bin/env bash
#
# apply.sh — Apply pending D1 migrations
# =======================================
# Usage:
#   cd website
#   ./functions/migrations/apply.sh                  # apply to luzestelar-db (production)
#   ./functions/migrations/apply.sh luzestelar-db-staging   # apply to a different DB
#
# How it works:
#   1. Reads the `_migrations` table from the target D1
#   2. Compares against `*.sql` files in this directory (sorted lexicographically)
#   3. Applies each pending file with `wrangler d1 execute --file=...`
#   4. Records the filename in `_migrations` after successful apply
#
# Bootstrap (first run on a fresh DB):
#   The 0001_migrations_table.sql migration creates the tracking table itself,
#   so the very first run will apply 0000 + 0001 unconditionally (the table
#   doesn't exist yet, so the "already applied" check returns nothing).
#
# Safety:
#   - Never modifies an already-applied migration. Edit a NEW file instead.
#   - Migrations are applied in lexicographic order. Use 4-digit prefixes.
#   - Stops on first failure. Inspect, fix, re-run.
#   - Records SHA-256 of each file at apply time so you can detect drift later.

set -euo pipefail

DB="${1:-luzestelar-db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$WEBSITE_DIR"

echo "→ Target database: $DB"
echo "→ Migrations dir:  $SCRIPT_DIR"

# Pull the list of already-applied migration IDs.
# The table may not exist yet on a fresh DB — in that case treat as empty.
applied_raw="$(npx wrangler d1 execute "$DB" --remote \
    --command="SELECT id FROM _migrations ORDER BY id" 2>&1 || true)"
if echo "$applied_raw" | grep -q "no such table: _migrations"; then
    echo "→ _migrations table not found — treating as fresh DB"
    applied_ids=""
else
    applied_ids="$(echo "$applied_raw" | grep -oE '"id": "[^"]+"' | sed 's/"id": "//; s/"$//' || true)"
fi

# Walk migration files in lex order
shopt -s nullglob
applied_count=0
skipped_count=0
for f in "$SCRIPT_DIR"/*.sql; do
    name="$(basename "$f" .sql)"
    if echo "$applied_ids" | grep -qx "$name"; then
        echo "  ⏭  $name (already applied)"
        skipped_count=$((skipped_count + 1))
        continue
    fi

    echo "  ▶  $name — applying..."
    npx wrangler d1 execute "$DB" --remote --file="$f" >/dev/null

    # Record in _migrations (after the file ran successfully)
    checksum="$(shasum -a 256 "$f" | awk '{print $1}')"
    now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    npx wrangler d1 execute "$DB" --remote \
        --command="INSERT INTO _migrations (id, applied_at, checksum) VALUES ('$name', '$now', '$checksum')" \
        >/dev/null
    echo "  ✓  $name applied at $now"
    applied_count=$((applied_count + 1))
done

echo ""
echo "Done. Applied: $applied_count   Skipped: $skipped_count"

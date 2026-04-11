# D1 Migrations

Tracks every schema change applied to the `luzestelar-db` D1 database, so we can:
- Recreate the schema from scratch deterministically (e.g. into a test branch).
- Detect drift if a manual `wrangler d1 execute` ever sneaks in.
- Avoid the "did I run this ALTER on prod yet?" problem.

## Workflow

To make a schema change:

1. Create a new file with the next 4-digit prefix:
   ```
   functions/migrations/0003_add_audit_log.sql
   ```
2. Write the SQL. Use `IF NOT EXISTS` / `IF EXISTS` where possible so the
   migration is safe to re-run if half-applied.
3. From the `website/` directory, run:
   ```bash
   ./functions/migrations/apply.sh
   ```
   It will skip everything that's already in `_migrations` and apply only
   the new file. On success, it inserts a row into `_migrations` with the
   filename, ISO timestamp, and SHA-256 checksum of the file at apply time.
4. Commit the new `.sql` file. The next environment (staging, fresh clone)
   will pick it up automatically.

## Rules

- **Never edit an applied migration.** Create a new one instead. The
  checksum stored in `_migrations` would no longer match.
- **One concern per file.** Easier to roll forward when something goes wrong.
- **Lex order matters.** Always use 4-digit prefixes (`0003`, `0004`, ...).
- **Production-safe SQL only.** Cloudflare D1 takes the database briefly
  offline during DDL — schedule large migrations during the daily
  pipeline window when traffic is lowest.

## Files

- `0000_initial.sql` — frozen copy of the original `schema.sql`. Do not edit.
- `0001_migrations_table.sql` — bootstraps the `_migrations` tracking table.
- `0002_add_new_systems.sql` — Mayan / Vedic / Human Design / Enneagram columns
  on `birth_profiles` (was a pre-existing one-shot file; renamed and backfilled
  on Apr 10, 2026 when migration tracking went live).
- `apply.sh` — idempotent runner. Reads `_migrations`, applies only the new
  files, records each apply with checksum + timestamp.

## Bootstrapping a new DB

```bash
# 1. Apply everything
./functions/migrations/apply.sh luzestelar-db-fresh

# 2. Done. The script handles 0001 + the migrations table itself.
```

## Backfilling state from an existing DB

If you took over a DB that pre-dates this system (like we did on Apr 10):

```bash
# 1. Apply 0001 to create the tracking table
npx wrangler d1 execute luzestelar-db --remote --file=./functions/migrations/0001_migrations_table.sql

# 2. Insert one row per already-applied migration
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
for f in functions/migrations/00*.sql; do
  id=$(basename "$f" .sql)
  cs=$(shasum -a 256 "$f" | awk '{print $1}')
  npx wrangler d1 execute luzestelar-db --remote \
    --command="INSERT INTO _migrations (id, applied_at, checksum) VALUES ('$id','$NOW','$cs')"
done

# 3. apply.sh should now report everything as already-applied
./functions/migrations/apply.sh
```

# Seeds — Expense Tracker feature tasks

Import the **Expense Tracker** feature backlog (categorized transactions,
budgets, recurring & installment payments) into this task-manager app.

| File | Purpose |
|------|---------|
| `expense-tracker-tasks.json` | 33 BE/FE tasks + tag definitions. Editable. |
| `import_tasks.py` | Loader — creates the tags, then the tasks, via the API. Stdlib only. |

Source of truth for the tasks:
`../../Expense Tracker/Expense-Tracker/plan/FEATURE_CATEGORIES_TRANSACTIONS.md`

## How to import

1. **Start the task-manager backend** (from `task-manager/`):
   ```bash
   docker compose up -d postgres
   cd backend
   uvicorn app.main:app --reload      # -> http://localhost:8000
   ```

2. **Preview** what will be created (no API calls):
   ```bash
   python seeds/import_tasks.py --dry-run
   ```

3. **Import** into your account (creates the account if missing with `--register`):
   ```bash
   python seeds/import_tasks.py --email you@example.com --password "yourpass" --register
   ```

The script is **idempotent for tags** (reuses existing ones) but will create a
fresh task row each run — run it once, or delete duplicates if you re-run.

## Format (per task)

Matches the task-manager `TaskCreate` schema:

```json
{
  "title": "ET-BE-01 · Category & SubCategory entities + persistence",
  "description": "… acceptance criteria + deps …",
  "status": "todo",              // todo | in_progress | done
  "priority": "high",            // low | medium | high   (P3 | P2 | P1)
  "tags": ["expense-tracker", "backend", "categories"]
}
```

Tag names are resolved to IDs at import time; missing tags are created with the
colors defined in the `tags` section of the JSON.

> Security note: pass credentials on the command line only on your own machine.
> The script never stores them.

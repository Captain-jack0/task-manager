#!/usr/bin/env python
"""Run Alembic migration to create test_runs table."""
import sys
from pathlib import Path

# Change to backend directory
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from alembic.config import Config

    from alembic import command

    # Create Alembic config
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))

    # Run upgrade to head
    print("Running migration: alembic upgrade head")
    command.upgrade(alembic_cfg, "head")
    print("✓ Migration completed successfully!")

except ImportError as e:
    print("Error: alembic not installed. Run: pip install alembic", file=sys.stderr)
    print(f"Details: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error running migration: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)

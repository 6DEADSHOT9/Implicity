import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api" / "src"))

from implicity_api.setup import main, memory_check

if __name__ == "__main__":
    if sys.argv[1:] == ["--check-memory"]:
        raise SystemExit(memory_check())
    raise SystemExit(main())

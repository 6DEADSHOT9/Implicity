import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).parents[1]

with tempfile.TemporaryDirectory() as directory:
    env = {**os.environ, "UV_PROJECT_ENVIRONMENT": str(Path(directory) / ".venv")}
    env.pop("VIRTUAL_ENV", None)
    subprocess.run(
        ["uv", "sync", "--locked", "--no-dev", "--package", "implicity-engine"],
        cwd=ROOT,
        env=env,
        check=True,
    )
    subprocess.run(
        [
            "uv",
            "run",
            "--locked",
            "--no-dev",
            "--package",
            "implicity-engine",
            "scripts/contracts-runtime-smoke.py",
        ],
        cwd=ROOT,
        env=env,
        check=True,
    )

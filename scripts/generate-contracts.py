import argparse
import difflib
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).parents[1]
SCHEMA = ROOT / "contracts/schemas/index.json"
OUTPUTS = {
    "typescript": ROOT / "web/src/contracts/generated.ts",
    "python": ROOT / "api/app/contracts/generated.py",
}


def generate(output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    typescript = output_dir / "generated.ts"
    python = output_dir / "generated.py"
    subprocess.run(
        ["npx", "--yes", "pnpm@12.23.0", "exec", "json2ts", str(SCHEMA), str(typescript), "--bannerComment", ""],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(
        [
            "uv", "run", "--locked", "datamodel-codegen", "--input", str(SCHEMA),
            "--input-file-type", "jsonschema", "--output", str(python),
            "--output-model-type", "pydantic_v2.BaseModel", "--class-name", "Contracts",
            "--use-schema-description", "--disable-timestamp", "--formatters", "isort", "ruff-format",
        ],
        cwd=ROOT,
        check=True,
    )
    return {"typescript": typescript.read_text(), "python": python.read_text()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        generated = generate(Path(directory))
    stale = False
    for language, destination in OUTPUTS.items():
        current = destination.read_text() if destination.exists() else ""
        if args.check:
            if current != generated[language]:
                stale = True
                print(f"stale generated contract: {destination.relative_to(ROOT)}")
                print("".join(difflib.unified_diff(current.splitlines(True), generated[language].splitlines(True))))
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(generated[language])
            print(f"generated {destination.relative_to(ROOT)}")
    if stale:
        return 1
    if args.check:
        print("generated contracts are up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

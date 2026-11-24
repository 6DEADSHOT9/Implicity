import argparse
import difflib
import subprocess
import tempfile
from pathlib import Path

from implicity_contracts.freshness import schema_fingerprint

ROOT = Path(__file__).parents[1]
SCHEMA = ROOT / "contracts/schemas/index.json"
OUTPUTS = {
    "typescript": ROOT / "web/src/contracts/generated.ts",
    "python": ROOT / "contracts/python/implicity_contracts/generated.py",
    "schema": ROOT / "contracts/python/implicity_contracts/schema.json",
}


def generate(output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    typescript = output_dir / "generated.ts"
    python = output_dir / "generated.py"
    schema_copy = output_dir / "schema.json"
    fingerprint = schema_fingerprint(ROOT / "contracts/schemas", ROOT)
    subprocess.run(
        [
            "npx",
            "--yes",
            "pnpm@12.23.0",
            "exec",
            "json2ts",
            str(SCHEMA),
            str(typescript),
            "--bannerComment",
            "",
        ],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(
        [
            "uv",
            "run",
            "--locked",
            "datamodel-codegen",
            "--input",
            str(SCHEMA),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(python),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--class-name",
            "Contracts",
            "--use-schema-description",
            "--disable-timestamp",
            "--formatters",
            "isort",
            "ruff-format",
        ],
        cwd=ROOT,
        check=True,
    )
    python.write_text(
        python.read_text().replace(
            "model_config = ConfigDict(\n",
            "model_config = ConfigDict(\n        strict=True,\n",
        )
    )
    typescript.write_text(
        f"// Generated from contracts/schemas; run make contracts-generate.\n"
        f"// schema-sha256: {fingerprint}\n" + typescript.read_text()
    )
    python.write_text(
        f"# Generated from contracts/schemas; run make contracts-generate.\n"
        f"# schema-sha256: {fingerprint}\n" + python.read_text()
    )
    schema_copy.write_bytes(SCHEMA.read_bytes())
    return {
        "typescript": typescript.read_text(),
        "python": python.read_text(),
        "schema": schema_copy.read_text(),
    }


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
                print(
                    "".join(
                        difflib.unified_diff(
                            current.splitlines(True),
                            generated[language].splitlines(True),
                        )
                    )
                )
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

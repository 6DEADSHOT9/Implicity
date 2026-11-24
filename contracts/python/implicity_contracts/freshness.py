import hashlib
from pathlib import Path


def schema_fingerprint(schema_root: Path, repo_root: Path) -> str:
    digest = hashlib.sha256()
    for schema_file in sorted(schema_root.rglob("*.json")):
        digest.update(schema_file.relative_to(repo_root).as_posix().encode())
        digest.update(b"\0")
        digest.update(schema_file.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()

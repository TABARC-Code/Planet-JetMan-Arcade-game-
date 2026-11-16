"""Create the deterministic Lunar Jetman source release archive."""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RELEASE_DATE = (2026, 11, 16, 0, 0, 0)
ROOT_FILES = (
    "README.md", "RELEASE-README.md", "CHANGELOG.md", "PROGRAMMER-NOTES.md",
    "TEST-REPORT.md", "PROVENANCE.md", "CREDITS.txt", "index.html",
)
SOURCE_DIRS = ("source/assets", "source/tests", "source/tools", "source/web")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def include(path: Path) -> bool:
    return path.is_file() and "__pycache__" not in path.parts and path.suffix.lower() != ".pyc"


def version() -> str:
    text = (ROOT / "source" / "web" / "game.js").read_text(encoding="utf-8")
    match = re.search(r"const VERSION = '([^']+)'", text)
    if not match or "dev" in match.group(1):
        raise SystemExit("final VERSION marker missing from source/web/game.js")
    return match.group(1)


def write_zip(stage: Path, name: str, target: Path) -> None:
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(p for p in stage.rglob("*") if p.is_file()):
            info = zipfile.ZipInfo(f"{name}/{path.relative_to(stage).as_posix()}", RELEASE_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    output = args.output_root.resolve()
    output.mkdir(parents=True, exist_ok=True)
    release_version = version()
    name = f"LunarJetman-source-{release_version}"

    subprocess.run([sys.executable, str(ROOT / "source" / "tools" / "build_web.py")],
                   cwd=ROOT, check=True)
    built = ROOT / "source" / "dist_web" / "index.html"
    if built.read_bytes() != (ROOT / "index.html").read_bytes():
        raise SystemExit("top-level index.html does not match the rebuilt browser")

    with tempfile.TemporaryDirectory(prefix=".lj-source-", dir=output) as temporary:
        stage = Path(temporary) / name
        stage.mkdir()
        for filename in ROOT_FILES:
            copy(ROOT / filename, stage / filename)
        for dirname in SOURCE_DIRS:
            source_dir = ROOT / dirname
            for path in sorted(p for p in source_dir.rglob("*") if include(p)):
                copy(path, stage / path.relative_to(ROOT))
        manifest = [f"{sha256(path)}  {path.relative_to(stage).as_posix()}"
                    for path in sorted(p for p in stage.rglob("*") if p.is_file())]
        (stage / "MANIFEST-SHA256.txt").write_text("\n".join(manifest) + "\n", encoding="utf-8")
        target = output / f"{name}.zip"
        if target.exists():
            target.unlink()
        write_zip(stage, name, target)

    checksum = sha256(target)
    (output / f"{target.name}.sha256.txt").write_text(
        f"{checksum}  {target.name}\n", encoding="ascii")
    print(f"PACKAGE={target}")
    print(f"BYTES={target.stat().st_size}")
    print(f"SHA256={checksum}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

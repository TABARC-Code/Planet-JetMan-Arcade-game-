"""Create the deterministic, self-contained browser release archive."""
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
DOCS = ("CHANGELOG.md", "PROGRAMMER-NOTES.md", "TEST-REPORT.md", "PROVENANCE.md")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


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
    name = f"LunarJetman-browser-{release_version}"

    subprocess.run([sys.executable, str(ROOT / "source" / "tools" / "build_web.py")],
                   cwd=ROOT, check=True)
    built = ROOT / "source" / "dist_web" / "index.html"
    built_text = built.read_text(encoding="utf-8")
    if built_text.count(f"const VERSION = '{release_version}'") != 1:
        raise SystemExit("built browser version is missing or duplicated")
    if "<!--SCRIPTS-->" in built_text or re.search(r"<script[^>]+src=", built_text, re.I):
        raise SystemExit("browser build is not self-contained")

    with tempfile.TemporaryDirectory(prefix=".lj-browser-", dir=output) as temporary:
        stage = Path(temporary) / name
        stage.mkdir()
        copy(built, stage / "index.html")
        copy(ROOT / "RELEASE-README.md", stage / "README.md")
        copy(ROOT / "CREDITS.txt", stage / "CREDITS.txt")
        for document in DOCS:
            copy(ROOT / document, stage / document)
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

"""Discover CSV files and notes.txt from a directory or a ZIP archive.

ZIP members are read into memory (never extracted to disk), so archive paths
cannot escape the target directory.
"""
import io
import os
import zipfile
from dataclasses import dataclass


@dataclass
class SourceFile:
    name: str          # path inside the archive / directory
    data: bytes
    origin: str        # zip path or directory


def discover(source):
    """Return (csv_files, notes_file, other_files) from a directory or .zip."""
    files = []
    if os.path.isfile(source) and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as zf:
            for info in zf.infolist():
                if info.is_dir() or "__MACOSX" in info.filename or os.path.basename(info.filename).startswith("._"):
                    continue
                files.append(SourceFile(info.filename, zf.read(info), source))
    elif os.path.isdir(source):
        for root, _, names in os.walk(source):
            # skip generated / code folders when reading a project directory
            rel_root = os.path.relpath(root, source)
            if rel_root != "." and rel_root.split(os.sep)[0] in {"output", "app", "pipeline", "config", "tests", ".git"}:
                continue
            for n in sorted(names):
                if n.lower().endswith((".csv", ".txt")):
                    p = os.path.join(root, n)
                    with open(p, "rb") as fh:
                        files.append(SourceFile(os.path.relpath(p, source), fh.read(), source))
    else:
        raise FileNotFoundError(f"Source must be a directory or ZIP archive: {source}")

    csvs = sorted((f for f in files if f.name.lower().endswith(".csv")), key=lambda f: f.name)
    notes = [f for f in files if os.path.basename(f.name).lower() == "notes.txt"]
    other = [f for f in files if f not in csvs and f not in notes]
    return csvs, (notes[0] if notes else None), other


def decode(data):
    """Decode bytes, reporting the encoding actually used."""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = data.decode(enc)
            if enc == "utf-8-sig" and not data.startswith(b"\xef\xbb\xbf"):
                enc = "utf-8"
            return text, enc
        except UnicodeDecodeError:
            continue
    raise ValueError("undecodable file")


def as_buffer(text):
    return io.StringIO(text)

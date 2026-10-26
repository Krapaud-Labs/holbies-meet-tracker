#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--root PROJECT_ROOT]" >&2
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$script_dir/.." && pwd)"
if [ "$#" -gt 0 ]; then
  if [ "$#" -ne 2 ] || [ "$1" != "--root" ] || [ -z "$2" ]; then
    usage
    exit 2
  fi
  [ -d "$2" ] || { echo "Racine projet absente: $2" >&2; exit 2; }
  root="$(cd "$2" && pwd)"
fi

python_bin=""
for candidate in python3.14 python3.13 python3.12 python3.11 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    version="$($candidate -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    major="${version%%.*}"
    minor="${version#*.}"
    if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] && [ "$major" -eq 3 ] && [ "$minor" -ge 11 ]; then
      python_bin="$candidate"
      break
    fi
  fi
done
[ -n "$python_bin" ] || { echo "Python 3.11 ou supérieur requis." >&2; exit 2; }

exec "$python_bin" - "$root" <<'PY'
import csv
import datetime as dt
import hashlib
import os
import re
import stat
import sys
from pathlib import Path, PurePosixPath

root = Path(sys.argv[1]).resolve()
docs = root / "docs"
manifest = docs / "project-management" / "archive-manifest.tsv"
archive_prefix = "docs/project-management/cahier-des-charges/holbies-meet-tracker/"
headers = ["path", "sha256", "category", "source", "hash_role"]
archive_categories = {"historical-source", "change-record", "provenance-record", "candidate-reconstruction", "checksum-manifest"}
hash_roles = {"archive-integrity", "candidate-reconstruction", "candidate-checksum"}
statuses = {"draft", "review", "approved", "updated", "needs-review"}
document_categories = {"product", "design", "operations", "quality", "project-management", "delivery", "reference"}
errors = []
active_ok = 0
archive_ok = 0
missing_manifest = False

def rel(path):
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)

def report(path, reason):
    errors.append((str(path), reason))

def regular_file(path):
    try:
        return stat.S_ISREG(path.lstat().st_mode)
    except OSError:
        return False

def safe_components(path):
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return False
    current = root
    for part in parts:
        current = current / part
        try:
            if stat.S_ISLNK(current.lstat().st_mode):
                return False
        except OSError:
            return False
    return True

def strip_yaml_comment(value):
    quote = None
    escaped = False
    index = 0
    while index < len(value):
        char = value[index]
        if quote == '"':
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quote = None
        elif quote == "'":
            if char == "'":
                if index + 1 < len(value) and value[index + 1] == "'":
                    index += 1
                else:
                    quote = None
        elif char in ('"', "'"):
            quote = char
        elif char == "#" and index > 0 and value[index - 1].isspace():
            return value[:index].rstrip()
        index += 1
    return value.rstrip()

def scalar(value):
    value = strip_yaml_comment(value.strip())
    if not value:
        return ""
    if value.startswith('"'):
        if len(value) < 2 or not value.endswith('"'):
            raise ValueError("chaîne YAML doublement citée invalide")
        body = value[1:-1]
        if re.search(r'(?<!\\)"', body):
            raise ValueError("guillemet double non échappé")
        return re.sub(r'\\([\\"nrt])', lambda m: {"\\": "\\", '"': '"', "n": "\n", "r": "\r", "t": "\t"}[m.group(1)], body)
    if value.startswith("'"):
        if len(value) < 2 or not value.endswith("'"):
            raise ValueError("chaîne YAML simplement citée invalide")
        body = value[1:-1]
        parsed = []
        index = 0
        while index < len(body):
            if body[index] == "'":
                if index + 1 >= len(body) or body[index + 1] != "'":
                    raise ValueError("apostrophe YAML non doublée dans une chaîne citée")
                parsed.append("'")
                index += 2
            else:
                parsed.append(body[index])
                index += 1
        return "".join(parsed)
    if value in {"~", "null", "Null", "NULL"}:
        return ""
    if value and value[0] in "[]{}!&*#|>@`%":
        raise ValueError("valeur YAML non scalaire ou ambiguë")
    return value

def front_matter(text):
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise ValueError("front matter absent au début du fichier")
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise ValueError("délimiteur de fin front matter absent")
    values = {}
    for number, line in enumerate(lines[1:end], 2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "\t" in line:
            raise ValueError(f"tabulation YAML interdite ligne {number}")
        match = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_-]*):(?: +(.*))?", line)
        if not match:
            raise ValueError(f"syntaxe YAML non prise en charge ligne {number}")
        key = match.group(1)
        if key in values:
            raise ValueError(f"clé dupliquée: {key}")
        values[key] = scalar(match.group(2) or "")
    return values

def check_active(path):
    global active_ok
    name = rel(path)
    initial_errors = len(errors)
    try:
        text = path.read_bytes().decode("utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        report(name, f"lecture UTF-8 impossible ({exc})")
        return
    if "A_COMPLETER" in text:
        report(name, "marqueur A_COMPLETER présent")
    try:
        values = front_matter(text)
    except ValueError as exc:
        report(name, str(exc))
        return
    for field in ("title", "status", "last_updated", "category"):
        if not values.get(field, "").strip():
            report(name, f"champ obligatoire absent ou vide: {field}")
    if values.get("status") and values["status"] not in statuses:
        report(name, f"status invalide: {values['status']}")
    date = values.get("last_updated", "")
    if date and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        report(name, "last_updated doit respecter YYYY-MM-DD")
    elif date:
        try:
            dt.date.fromisoformat(date)
        except ValueError:
            report(name, "last_updated n’est pas une date calendaire valide")
    if values.get("category") and values["category"] not in document_categories:
        report(name, f"category invalide: {values['category']}")
    if len(errors) == initial_errors:
        active_ok += 1

def discover_markdown():
    found = []
    def on_walk_error(exc):
        report(rel(Path(exc.filename or docs)), f"répertoire inaccessible pendant le scan ({exc.strerror or exc})")

    for current, dirs, names in os.walk(docs, followlinks=False, onerror=on_walk_error):
        folder = Path(current)
        dirs.sort()
        names.sort()
        for dirname in list(dirs):
            child = folder / dirname
            try:
                if stat.S_ISLNK(child.lstat().st_mode):
                    report(rel(child), "répertoire symbolique interdit")
                    dirs.remove(dirname)
            except OSError:
                report(rel(child), "répertoire inaccessible")
                dirs.remove(dirname)
        for filename in names:
            if Path(filename).suffix.lower() != ".md":
                continue
            path = folder / filename
            try:
                mode = path.lstat().st_mode
            except OSError:
                report(rel(path), "fichier inaccessible")
                continue
            if stat.S_ISLNK(mode):
                report(rel(path), "lien symbolique Markdown interdit")
            elif stat.S_ISREG(mode):
                found.append(path)
            else:
                report(rel(path), "Markdown non régulier")
    return sorted(found, key=rel)

def check_manifest():
    global archive_ok, missing_manifest
    registered_paths = set()
    if not manifest.exists():
        report(rel(manifest), "manifeste d’archives absent")
        missing_manifest = True
        return registered_paths
    if not regular_file(manifest) or not safe_components(manifest):
        report(rel(manifest), "manifeste non régulier ou contenant un lien symbolique")
        return registered_paths
    try:
        with manifest.open("r", encoding="utf-8", newline="") as stream:
            rows = list(csv.reader(stream, delimiter="\t"))
    except (OSError, UnicodeDecodeError, csv.Error) as exc:
        report(rel(manifest), f"lecture TSV impossible ({exc})")
        return registered_paths
    if not rows or rows[0] != headers:
        report(rel(manifest), "en-tête TSV invalide; colonnes attendues: " + ", ".join(headers))
        return registered_paths
    if len(rows) == 1:
        report(rel(manifest), "manifeste d’archives vide")
        return registered_paths
    seen = set()
    for line, row in enumerate(rows[1:], 2):
        label = f"{rel(manifest)}:{line}"
        if len(row) != len(headers):
            report(label, "nombre de colonnes invalide")
            continue
        entry = dict(zip(headers, row))
        if any(not value.strip() for value in row):
            report(label, "champ requis vide")
            continue
        path_text = entry["path"]
        posix = PurePosixPath(path_text)
        if posix.is_absolute() or "\\" in path_text or posix.as_posix() != path_text or any(part in ("", ".", "..") for part in path_text.split("/")):
            report(label, "chemin non canonique, absolu ou contenant traversal")
            continue
        if path_text in seen:
            report(label, f"chemin dupliqué: {path_text}")
            continue
        seen.add(path_text)
        if not path_text.startswith(archive_prefix):
            report(label, "chemin hors du périmètre d’archives")
            continue
        if not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
            report(label, "sha256 doit contenir 64 caractères hexadécimaux minuscules")
            continue
        if entry["category"] not in archive_categories:
            report(label, f"category inconnue: {entry['category']}")
            continue
        if entry["hash_role"] not in hash_roles:
            report(label, f"hash_role inconnu: {entry['hash_role']}")
            continue
        if entry["hash_role"] == "candidate-reconstruction" and entry["category"] != "candidate-reconstruction":
            report(label, "hash_role candidate-reconstruction exige category candidate-reconstruction")
            continue
        if entry["hash_role"] == "candidate-checksum" and entry["category"] != "checksum-manifest":
            report(label, "hash_role candidate-checksum exige category checksum-manifest")
            continue
        expected_role = {
            "historical-source": "archive-integrity",
            "change-record": "archive-integrity",
            "provenance-record": "archive-integrity",
            "candidate-reconstruction": "candidate-reconstruction",
            "checksum-manifest": "candidate-checksum",
        }[entry["category"]]
        if entry["hash_role"] != expected_role:
            report(label, f"category {entry['category']} incompatible avec hash_role {entry['hash_role']}")
            continue
        path = root / path_text
        if not path.exists() and not path.is_symlink():
            report(label, "fichier d’archive absent")
            continue
        if not safe_components(path):
            report(label, "chemin contenant un lien symbolique")
            continue
        if not regular_file(path):
            report(label, "fichier d’archive absent ou non régulier")
            continue
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        except OSError as exc:
            report(label, f"lecture de l’archive impossible ({exc})")
            continue
        if digest != entry["sha256"]:
            report(label, f"empreinte différente pour {path_text}")
            continue
        archive_ok += 1
        registered_paths.add(path_text)
    return registered_paths

if not docs.is_dir():
    print(f"Documentation absente: {rel(docs)}", file=sys.stderr)
    raise SystemExit(2)
if not safe_components(docs):
    report(rel(docs), "répertoire docs absent ou contenant un lien symbolique")
    print(f"ERREUR {errors[-1][0]} : {errors[-1][1]}", file=sys.stderr)
    print("Résumé : 0 document actif conforme, 0 archive vérifiée, 1 erreur")
    raise SystemExit(1)

markdown = discover_markdown()
registered = check_manifest()
archive_root = root / archive_prefix.rstrip("/")
if not archive_root.is_dir():
    report(rel(archive_root), "répertoire d’archives absent")
elif safe_components(archive_root):
    def on_archive_walk_error(exc):
        report(rel(Path(exc.filename or archive_root)), f"répertoire d’archive inaccessible pendant le scan ({exc.strerror or exc})")

    for current, dirs, names in os.walk(archive_root, followlinks=False, onerror=on_archive_walk_error):
        folder = Path(current)
        dirs.sort()
        names.sort()
        for dirname in list(dirs):
            child = folder / dirname
            if child.is_symlink():
                report(rel(child), "lien symbolique dans le périmètre d’archives")
                dirs.remove(dirname)
        for filename in names:
            path = folder / filename
            if path.is_symlink():
                report(rel(path), "lien symbolique dans le périmètre d’archives")
            elif path.is_file():
                if rel(path) not in registered:
                    report(rel(path), "fichier d’archive absent du manifeste")
            else:
                report(rel(path), "fichier d’archive non régulier")
for path in markdown:
    if not rel(path).startswith(archive_prefix):
        check_active(path)

for path, reason in sorted(errors):
    print(f"ERREUR {path} : {reason}", file=sys.stderr)
print(f"Résumé : {active_ok} documents actifs conformes, {archive_ok} archives vérifiées, {len(errors)} erreur(s)")
raise SystemExit(2 if missing_manifest else 1 if errors else 0)
PY

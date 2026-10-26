from __future__ import annotations

import csv
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[1]
VALIDATOR = REPOSITORY / "scripts" / "validate-documentation.sh"
FIXTURE = REPOSITORY / "tests" / "fixtures" / "documentation-validator" / "valid"
MANIFEST = Path("docs/project-management/archive-manifest.tsv")
ARCHIVE_DIR = Path("docs/project-management/cahier-des-charges/holbies-meet-tracker")
ARCHIVE_SOURCE = ARCHIVE_DIR / "historique.md"
HEADERS = ["path", "sha256", "category", "source", "hash_role"]
VALID_FRONT_MATTER = "---\ntitle: Fixture\nstatus: review\nlast_updated: 2026-10-26\ncategory: quality\n---\n\nContenu valide.\n"


class DocumentationValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="doc-validator-")
        self.root = Path(self.temp.name) / "project"
        shutil.copytree(FIXTURE, self.root)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def reset_fixture(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)
        shutil.copytree(FIXTURE, self.root)

    def run_validator(self, *args: str, root: Path | None = None) -> subprocess.CompletedProcess[str]:
        selected_root = root or self.root
        return subprocess.run(
            ["bash", str(VALIDATOR), "--root", str(selected_root), *args],
            text=True,
            capture_output=True,
            check=False,
        )

    def read_manifest(self) -> list[list[str]]:
        with (self.root / MANIFEST).open(encoding="utf-8", newline="") as stream:
            return list(csv.reader(stream, delimiter="\t"))

    def write_manifest(self, rows: list[list[str]]) -> None:
        with (self.root / MANIFEST).open("w", encoding="utf-8", newline="") as stream:
            csv.writer(stream, delimiter="\t", lineterminator="\n").writerows(rows)

    def rewrite_row(self, index: int, column: str, value: str) -> None:
        rows = self.read_manifest()
        rows[index][HEADERS.index(column)] = value
        self.write_manifest(rows)

    def assert_invalid(self, reason: str) -> None:
        result = self.run_validator()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(reason, result.stderr, result.stderr)

    def test_valid_active_and_three_hash_roles_accept_archives_without_front_matter(self) -> None:
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("1 documents actifs conformes, 3 archives vérifiées, 0 erreur", result.stdout)

    def test_active_without_front_matter_is_rejected(self) -> None:
        (self.root / "docs/README.md").write_text("Pas de métadonnées.\n", encoding="utf-8")
        self.assert_invalid("front matter absent")

    def test_required_fields_missing_and_empty_are_rejected(self) -> None:
        fields = {
            "title": "title: Fixture",
            "status": "status: review",
            "last_updated": "last_updated: 2026-10-26",
            "category": "category: quality",
        }
        for field in fields:
            with self.subTest(field=field, state="missing"):
                lines = [line for line in VALID_FRONT_MATTER.splitlines() if not line.startswith(f"{field}:")]
                (self.root / "docs/README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
                self.assert_invalid(f"champ obligatoire absent ou vide: {field}")
            with self.subTest(field=field, state="empty"):
                lines = [f"{field}:" if line.startswith(f"{field}:") else line for line in VALID_FRONT_MATTER.splitlines()]
                (self.root / "docs/README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
                self.assert_invalid(f"champ obligatoire absent ou vide: {field}")

    def test_yaml_null_and_tilde_are_empty_required_values(self) -> None:
        for value in ("null", "Null", "NULL", "~", "null # commentaire", "Null # commentaire", "~ # commentaire"):
            with self.subTest(value=value):
                body = VALID_FRONT_MATTER.replace("title: Fixture", f"title: {value}")
                (self.root / "docs/README.md").write_text(body, encoding="utf-8")
                self.assert_invalid("champ obligatoire absent ou vide: title")
        quoted = VALID_FRONT_MATTER.replace("title: Fixture", 'title: "null"')
        (self.root / "docs/README.md").write_text(quoted, encoding="utf-8")
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_quoted_values_allow_inline_comments_and_preserve_hashes(self) -> None:
        cases = [
            ('title: "Fixture" # commentaire', 0),
            ("title: 'Fixture' # commentaire", 0),
            ('title: "Fixture #1" # commentaire après guillemet', 0),
            ("title: '#'", 0),
            ("title: 'O''Reilly'", 0),
        ]
        for replacement, expected_status in cases:
            with self.subTest(title=replacement):
                (self.root / "docs/README.md").write_text(
                    VALID_FRONT_MATTER.replace("title: Fixture", replacement), encoding="utf-8"
                )
                result = self.run_validator()
                self.assertEqual(result.returncode, expected_status, result.stdout + result.stderr)
        (self.root / "docs/README.md").write_text(
            VALID_FRONT_MATTER.replace("title: Fixture", "title: 'O'Reilly'"), encoding="utf-8"
        )
        self.assert_invalid("apostrophe YAML non doublée")

    def test_invalid_status_category_and_calendar_dates_are_rejected(self) -> None:
        cases = [
            ("status: bogus", "status invalide"),
            ("category: hidden", "category invalide"),
            ("last_updated: 2026-2-06", "last_updated doit respecter YYYY-MM-DD"),
            ("last_updated: 2026-02-30", "n’est pas une date calendaire valide"),
        ]
        for replacement, reason in cases:
            with self.subTest(replacement=replacement):
                body = VALID_FRONT_MATTER.replace(replacement.split(":")[0] + ": review" if replacement.startswith("status") else "category: quality" if replacement.startswith("category") else "last_updated: 2026-10-26", replacement)
                (self.root / "docs/README.md").write_text(body, encoding="utf-8")
                self.assert_invalid(reason)

    def test_malformed_or_duplicate_yaml_front_matter_is_rejected(self) -> None:
        cases = [
            ("---\ntitle: Missing end\n", "délimiteur de fin"),
            ("---\ntitle: A\ntitle: B\n---\n", "clé dupliquée: title"),
            ("---\ntitle: Fixture\nlabels:\n  - one\n---\n", "syntaxe YAML non prise en charge"),
        ]
        for body, reason in cases:
            with self.subTest(reason=reason):
                (self.root / "docs/README.md").write_text(body, encoding="utf-8")
                self.assert_invalid(reason)

    def test_incomplete_marker_is_rejected(self) -> None:
        (self.root / "docs/README.md").write_text(VALID_FRONT_MATTER + "A_COMPLETER\n", encoding="utf-8")
        self.assert_invalid("marqueur A_COMPLETER")

    def test_untracked_new_markdown_is_scanned(self) -> None:
        (self.root / "docs/new-untracked.md").write_text("Document ajouté sans front matter.\n", encoding="utf-8")
        self.assert_invalid("docs/new-untracked.md : front matter absent")

    def test_modified_or_missing_registered_archives_fail(self) -> None:
        (self.root / ARCHIVE_SOURCE).write_text("source altérée\n", encoding="utf-8")
        self.assert_invalid("empreinte différente")
        self.reset_fixture()
        (self.root / ARCHIVE_SOURCE).unlink()
        self.assert_invalid("fichier d’archive absent")

    def test_every_file_in_archive_scope_must_be_registered(self) -> None:
        for name in ("nouvelle-source.md", "nouveau-sidecar.txt"):
            with self.subTest(name=name):
                path = self.root / ARCHIVE_DIR / name
                path.write_text("fichier non déclaré\n", encoding="utf-8")
                self.assert_invalid(f"{name} : fichier d’archive absent du manifeste")
                path.unlink()

    def test_manifest_header_rows_duplicates_paths_and_empty_fields_fail(self) -> None:
        cases = [
            (lambda rows: rows.__setitem__(0, ["wrong"]), "en-tête TSV invalide"),
            (lambda rows: rows.__setitem__(0, ["sha256", "path", "category", "source", "hash_role"]), "en-tête TSV invalide"),
            (lambda rows: rows.append(rows[1].copy()), "chemin dupliqué"),
            (lambda rows: rows[1].pop(), "nombre de colonnes invalide"),
            (lambda rows: rows[1].append("unexpected"), "nombre de colonnes invalide"),
            (lambda rows: rows[1].__setitem__(1, "not-a-hash"), "64 caractères hexadécimaux"),
            (lambda rows: rows[1].__setitem__(1, ""), "champ requis vide"),
            (lambda rows: rows[1].__setitem__(3, ""), "champ requis vide"),
            (lambda rows: rows[1].__setitem__(0, ""), "champ requis vide"),
            (lambda rows: rows[1].__setitem__(2, ""), "champ requis vide"),
            (lambda rows: rows[1].__setitem__(4, ""), "champ requis vide"),
            (lambda rows: rows[1].__setitem__(2, "unknown"), "category inconnue"),
            (lambda rows: rows[1].__setitem__(4, "original-brief"), "hash_role inconnu"),
            (lambda rows: rows[1].__setitem__(2, "candidate-reconstruction"), "incompatible avec hash_role"),
            (lambda rows: rows[1].__setitem__(0, "docs/README.md"), "hors du périmètre d’archives"),
            (lambda rows: rows[1].__setitem__(0, str(ARCHIVE_DIR / "../outside.md")), "containing traversal"),
            (lambda rows: rows[1].__setitem__(0, "/" + str(ARCHIVE_SOURCE)), "chemin non canonique"),
            (lambda rows: rows[1].__setitem__(0, str(ARCHIVE_DIR) + "/./historique.md"), "chemin non canonique"),
        ]
        for mutate, reason in cases:
            with self.subTest(reason=reason):
                self.reset_fixture()
                rows = self.read_manifest()
                mutate(rows)
                self.write_manifest(rows)
                expected = "traversal" if reason == "containing traversal" else reason
                self.assert_invalid(expected)

    def test_missing_manifest_is_rejected(self) -> None:
        (self.root / MANIFEST).unlink()
        result = self.run_validator()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("manifeste d’archives absent", result.stderr)

    def test_header_only_manifest_is_rejected(self) -> None:
        self.write_manifest([HEADERS])
        result = self.run_validator()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("manifeste d’archives vide", result.stderr)

    def test_missing_archive_directory_is_rejected(self) -> None:
        shutil.rmtree(self.root / ARCHIVE_DIR)
        result = self.run_validator()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("répertoire d’archives absent", result.stderr)

    def test_symlinks_in_docs_archive_manifest_and_archive_components_fail(self) -> None:
        components = [
            Path("docs"),
            Path("docs/project-management"),
            Path("docs/project-management/cahier-des-charges"),
            ARCHIVE_DIR,
            ARCHIVE_SOURCE,
            MANIFEST,
        ]
        for index, component in enumerate(components):
            with self.subTest(component=str(component)):
                self.reset_fixture()
                target = self.root / component
                backup = self.root / f"symlink-target-{index}"
                target.rename(backup)
                target.symlink_to(backup, target_is_directory=backup.is_dir())
                result = self.run_validator()
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("symbolique", result.stderr)

    def assert_unreadable_subdirectory_fails(self, relative_dir: Path, diagnostic: str) -> None:
        blocked = self.root / relative_dir
        blocked.mkdir(parents=True)
        (blocked / "hidden.md").write_text("un fichier caché du scan\n", encoding="utf-8")
        blocked.chmod(0)
        try:
            try:
                list(blocked.iterdir())
            except PermissionError:
                pass
            else:
                self.skipTest("le processus peut toujours lire le dossier après chmod(0); scénario non simulable ici")
            result = self.run_validator()
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn(diagnostic, result.stderr)
            self.assertIn(str(relative_dir), result.stderr)
        finally:
            blocked.chmod(0o700)

    def test_unreadable_docs_subdirectory_fails_closed(self) -> None:
        self.assert_unreadable_subdirectory_fails(Path("docs/unreadable-subtree"), "répertoire inaccessible pendant le scan")

    def test_unreadable_archive_subdirectory_fails_closed(self) -> None:
        self.assert_unreadable_subdirectory_fails(ARCHIVE_DIR / "unreadable-subtree", "répertoire d’archive inaccessible pendant le scan")

    def test_symlink_to_active_markdown_is_rejected(self) -> None:
        target = self.root / "docs/README.md"
        link = self.root / "docs/active-link.md"
        link.symlink_to(target)
        self.assert_invalid("active-link.md : lien symbolique Markdown interdit")

    def test_error_diagnostics_are_deterministic(self) -> None:
        (self.root / "docs/README.md").write_text("invalid document\n", encoding="utf-8")
        first = self.run_validator()
        second = self.run_validator()
        self.assertEqual(first.returncode, second.returncode)
        self.assertEqual(first.stdout, second.stdout)
        self.assertEqual(first.stderr, second.stderr)

    def test_cli_invalid_usage_and_missing_docs_have_usage_error(self) -> None:
        invalid = subprocess.run(["bash", str(VALIDATOR), "--bad"], text=True, capture_output=True, check=False)
        self.assertEqual(invalid.returncode, 2)
        missing_docs = Path(self.temp.name) / "without-docs"
        missing_docs.mkdir()
        result = self.run_validator(root=missing_docs)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Documentation absente", result.stderr)

    def test_real_repository_active_errors_remain_visible_and_archives_are_not_false_positives(self) -> None:
        result = subprocess.run(["bash", str(VALIDATOR)], text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("ERREUR docs/", result.stderr)
        self.assertNotIn("ERREUR docs/project-management/cahier-des-charges/", result.stderr)
        self.assertIn("6 archives vérifiées", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('release_cleanup', Path(__file__).with_name('cleanup-release-backups.py'))
cleanup = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = cleanup
spec.loader.exec_module(cleanup)


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.now = 1_000_000
        self.latest = self.backup('latest', 10)
        self.previous = self.backup('previous', 100)
        self.old = self.backup('old', 200_000)

    def backup(self, name, age, marked=True):
        runtime = self.root / 'releases' / name / 'runtime'
        runtime.mkdir(parents=True)
        dump = runtime / 'database.dump'
        dump.write_bytes(b'PGDMP example archive')
        os.utime(dump, (self.now - age, self.now - age))
        if marked:
            (runtime / 'backup-verified').write_text(str(dump.stat().st_size))
        return dump

    def test_retains_two_newest_and_only_plans_old_verified_copy(self):
        retained, candidates = cleanup.plan(self.root, {self.latest.parent}, self.now)
        self.assertEqual([b.dump for b in retained], [self.latest, self.previous])
        self.assertEqual([b.dump for b in candidates], [self.old])
        self.assertTrue(self.old.exists())  # Planning is read-only.

    def test_protects_active_old_release(self):
        self.assertEqual(cleanup.plan(self.root, {self.old.parent}, self.now)[1], [])

    def test_leaves_recent_and_unverified_or_size_mismatched_files(self):
        young = self.backup('young', 1000)
        partial = self.backup('partial', 300_000, marked=False)
        wrong = self.backup('wrong-size', 400_000)
        (wrong.parent / 'backup-verified').write_text('1')
        _, candidates = cleanup.plan(self.root, set(), self.now)
        self.assertNotIn(young, [b.dump for b in candidates])
        self.assertNotIn(partial, [b.dump for b in candidates])
        self.assertNotIn(wrong, [b.dump for b in candidates])

    def test_requires_two_backups(self):
        self.previous.unlink()
        self.old.unlink()
        with self.assertRaisesRegex(RuntimeError, 'Fewer than two'):
            cleanup.plan(self.root, set(), self.now)

    def test_failed_archive_validation_deletes_nothing(self):
        retained, candidates = cleanup.plan(self.root, set(), self.now)
        def fail(_):
            raise RuntimeError('bad archive')
        with self.assertRaisesRegex(RuntimeError, 'bad archive'):
            cleanup.apply_cleanup(retained, candidates, fail, lambda: None)
        self.assertTrue(self.old.exists())

    def test_changed_candidate_stops_cleanup(self):
        retained, candidates = cleanup.plan(self.root, set(), self.now)
        self.old.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            cleanup.apply_cleanup(retained, candidates, lambda _: None, lambda: None)
        self.assertTrue(self.old.exists())

    def test_changed_active_release_stops_cleanup(self):
        retained, candidates = cleanup.plan(self.root, set(), self.now)
        def fail():
            raise RuntimeError('active release changed')
        with self.assertRaisesRegex(RuntimeError, 'active release changed'):
            cleanup.apply_cleanup(retained, candidates, lambda _: None, fail)
        self.assertTrue(self.old.exists())

    def test_deletes_only_candidate_and_its_marker_preserving_history_and_rollback(self):
        history = self.root / 'backups' / 'historical.dump'
        history.parent.mkdir()
        history.write_bytes(b'historical backup')
        config = self.old.parent / 'rollback.json'
        config.write_text('{}')
        database = self.root / 'postgres_data'
        database.mkdir()
        (database / 'performance').write_text('last month')
        retained, candidates = cleanup.plan(self.root, set(), self.now)
        validated = []
        size = self.old.stat().st_size
        self.assertEqual(cleanup.apply_cleanup(retained, candidates, validated.append, lambda: None), size)
        self.assertEqual(len(validated), 2)
        self.assertFalse(self.old.exists())
        self.assertFalse((self.old.parent / 'backup-verified').exists())
        self.assertTrue(self.latest.exists())
        self.assertTrue(self.previous.exists())
        self.assertTrue(history.exists())
        self.assertTrue(config.exists())
        self.assertEqual((database / 'performance').read_text(), 'last month')


if __name__ == '__main__':
    unittest.main()

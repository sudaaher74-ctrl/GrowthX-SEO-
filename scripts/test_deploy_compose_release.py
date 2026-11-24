from collections import namedtuple
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('deploy_release', Path(__file__).with_name('deploy-compose-release.py'))
deploy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = deploy
spec.loader.exec_module(deploy)

DiskUsage = namedtuple('DiskUsage', ['total', 'used', 'free'])


class DeployComposeReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.runtime = Path(self.temp.name) / 'runtime'
        self.runtime.mkdir()
        (self.runtime / 'compose.json').write_text(json.dumps({
            'name': 'growthx-desktop',
            'services': {
                'postgres': {
                    'environment': {
                        'POSTGRES_USER': 'growthx',
                        'POSTGRES_DB': 'growthx_crawler',
                    }
                }
            }
        }))

    def test_defaults_to_fast_compression_level_1_and_validates_range(self):
        self.assertEqual(deploy.resolve_backup_compression({}), '1')
        self.assertEqual(deploy.resolve_backup_compression({'DEPLOY_BACKUP_COMPRESSION': '6'}), '6')
        with self.assertRaises(SystemExit):
            deploy.resolve_backup_compression({'DEPLOY_BACKUP_COMPRESSION': '10'})

    def test_blocks_backup_before_pg_dump_when_free_space_is_below_threshold(self):
        calls = []

        def fake_run(args, **kwargs):
            calls.append(args)

        low_disk = lambda _p: DiskUsage(100 * 1024**3, 95 * 1024**3, 5 * 1024**3)
        with self.assertRaisesRegex(SystemExit, 'Insufficient free disk space'):
            deploy.run_backup_phase(self.runtime, run_fn=fake_run, disk_usage_fn=low_disk, env={}, extra_paths=[])
        self.assertEqual(calls, [])
        self.assertFalse((self.runtime / 'database.dump').exists())

    def test_removes_partial_unverified_dump_if_pg_dump_fails(self):
        def failing_run(args, **kwargs):
            if 'pg_dump' in args:
                kwargs['stdout'].write(b'partial-dump-data')
                raise RuntimeError('SIGBUS simulated')

        plenty_disk = lambda _p: DiskUsage(500 * 1024**3, 100 * 1024**3, 400 * 1024**3)
        with self.assertRaisesRegex(RuntimeError, 'SIGBUS simulated'):
            deploy.run_backup_phase(self.runtime, run_fn=failing_run, disk_usage_fn=plenty_disk, env={}, extra_paths=[])
        self.assertFalse((self.runtime / 'database.dump').exists())
        self.assertFalse((self.runtime / 'backup-verified').exists())

    def test_completes_compressed_backup_and_writes_verified_marker(self):
        seen_cmds = []

        def ok_run(args, **kwargs):
            seen_cmds.append(args)
            if 'pg_dump' in args:
                kwargs['stdout'].write(b'PGDMP compressed')

        plenty_disk = lambda _p: DiskUsage(500 * 1024**3, 100 * 1024**3, 400 * 1024**3)
        deploy.run_backup_phase(self.runtime, run_fn=ok_run, disk_usage_fn=plenty_disk, env={}, extra_paths=[])
        self.assertIn('-Z', seen_cmds[0])
        self.assertEqual(seen_cmds[0][seen_cmds[0].index('-Z') + 1], '1')
        self.assertTrue((self.runtime / 'backup-verified').is_file())
        self.assertEqual((self.runtime / 'backup-verified').read_text().strip(), str(len(b'PGDMP compressed')))

    def test_build_phase_untags_intermediate_stage_images_after_runner(self):
        seen_cmds = []

        def fake_run(args, **kwargs):
            seen_cmds.append(args)

        sha = 'a' * 40
        deploy.run_build_phase(Path('/tmp/ctx'), f'growthx-crawler:{sha}', sha, run_fn=fake_run)
        self.assertEqual(len(seen_cmds), 4)
        self.assertEqual(seen_cmds[0][:4], ['docker', 'build', '--target', 'deps'])
        self.assertEqual(seen_cmds[1][:4], ['docker', 'build', '--target', 'prod-deps'])
        self.assertEqual(seen_cmds[2][:4], ['docker', 'build', '--target', 'runner'])
        self.assertEqual(
            seen_cmds[3],
            ['docker', 'rmi', '--no-prune', f'growthx-crawler:{sha}-deps', f'growthx-crawler:{sha}-prod-deps'],
        )


if __name__ == '__main__':
    unittest.main()

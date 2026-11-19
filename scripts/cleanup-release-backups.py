#!/usr/bin/env python3
"""Review or remove obsolete release database.dump copies. No Docker pruning.

Preserves the newest two marked backups, active release backups, all snapshots
younger than 24 hours, and every file outside releases/*/runtime/database.dump.
An archive listing check is required for BOTH retained backups before deletion.
This checks archive headers/TOC, not a full database restore.
"""
import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
import time


@dataclass(frozen=True)
class Backup:
    dump: Path
    size: int
    modified_ns: int
    device: int
    inode: int


def snapshot(dump):
    s = dump.stat()
    return Backup(dump, s.st_size, s.st_mtime_ns, s.st_dev, s.st_ino)


def plan(live, active, now=None):
    live = Path(live).resolve(strict=True)
    releases = live / 'releases'
    if releases.is_symlink() or not releases.is_dir():
        raise RuntimeError('Expected a regular releases directory.')
    backups = []
    for release in releases.iterdir():
        runtime = release / 'runtime'
        dump, marker = runtime / 'database.dump', runtime / 'backup-verified'
        if any(p.is_symlink() for p in (release, runtime, dump, marker)):
            continue
        if not dump.is_file() or not marker.is_file():
            continue
        b = snapshot(dump)
        try:
            marked_size = int(marker.read_text().strip())
        except (ValueError, OSError):
            continue
        if b.size > 0 and b.size == marked_size:
            backups.append(b)
    backups.sort(key=lambda b: (b.modified_ns, str(b.dump)), reverse=True)
    if len(backups) < 2:
        raise RuntimeError('Fewer than two size-matched verified backups; nothing will be removed.')
    retained = backups[:2]
    active = {Path(p).resolve(strict=True) for p in active}
    cutoff = (time.time() if now is None else now) - 24 * 3600
    candidates = [b for b in backups[2:]
                  if b.dump.parent.resolve() not in active and b.modified_ns / 1e9 < cutoff]
    return retained, candidates


def active_runtimes(project, releases):
    result = subprocess.check_output(
        ['docker', 'inspect', f'{project}-api-1', f'{project}-worker-1'], text=True)
    paths = set()
    for container in json.loads(result):
        files = (container['Config'].get('Labels') or {}).get('com.docker.compose.project.config_files', '')
        if not files:
            raise RuntimeError('An API/worker container has no Compose source label; stopped.')
        for file in files.split(','):
            config = Path(file).resolve(strict=True)
            if not config.is_relative_to(releases):
                raise RuntimeError('Active configuration is outside the release tree; stopped.')
            paths.add(config.parent)
    return paths


def readable_archive(backup, postgres):
    if snapshot(backup.dump) != backup:
        raise RuntimeError('Retained backup changed during inspection; stopped.')
    with backup.dump.open('rb') as archive:
        subprocess.run(['docker', 'exec', '-i', postgres, 'pg_restore', '--list'],
                       stdin=archive, stdout=subprocess.DEVNULL, check=True)


def apply_cleanup(retained, candidates, validate, guard):
    for backup in retained:
        validate(backup)
    guard()
    for backup in retained + candidates:
        if backup.dump.is_symlink() or snapshot(backup.dump) != backup:
            raise RuntimeError('A backup changed during verification; stopped.')
    removed = 0
    for backup in candidates:
        guard()
        if backup.dump.is_symlink() or snapshot(backup.dump) != backup:
            raise RuntimeError('A candidate changed before deletion; stopped.')
        backup.dump.unlink()
        # A deleted archive must not leave a misleading verification marker.
        marker = backup.dump.parent / 'backup-verified'
        marker.unlink()
        print(f'Removed release backup: {backup.dump.parent.parent.name} ({backup.size / 1024**3:.2f} GiB)')
        removed += backup.size
    return removed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', type=Path, default=Path('/home/reigel/growthx-desktop'))
    parser.add_argument('--project', default='growthx-desktop')
    parser.add_argument('--apply', action='store_true', help='Delete listed older copies after validation')
    args = parser.parse_args()
    live = args.live.resolve(strict=True)
    releases = live / 'releases'
    active = active_runtimes(args.project, releases)
    retained, candidates = plan(live, active)
    for backup in retained:
        print(f'KEEP recent backup: {backup.dump.parent.parent.name} ({backup.size / 1024**3:.2f} GiB)')
    for backup in candidates:
        print(f'ELIGIBLE older backup: {backup.dump.parent.parent.name} ({backup.size / 1024**3:.2f} GiB)')
    print(f'Eligible total: {sum(b.size for b in candidates) / 1024**3:.2f} GiB')
    if not args.apply or not candidates:
        print('No files removed. Use --apply to remove eligible release backup copies.')
        return

    def unchanged():
        if active_runtimes(args.project, releases) != active:
            raise RuntimeError('Active release changed; cleanup stopped.')
        for backup in retained + candidates:
            # All ancestors must still be ordinary directories inside releases.
            for parent in (backup.dump.parent, backup.dump.parent.parent, releases):
                if parent.is_symlink() or not parent.resolve(strict=True).is_relative_to(releases):
                    raise RuntimeError('Release path changed; stopped.')

    total = apply_cleanup(retained, candidates,
                          lambda b: readable_archive(b, f'{args.project}-postgres-1'), unchanged)
    print(f'Freed {total / 1024**3:.2f} GiB inside Ubuntu. Windows VHD file size may not shrink immediately.')


if __name__ == '__main__':
    main()

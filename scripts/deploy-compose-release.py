#!/usr/bin/env python3
"""Deploy a committed release to an existing Linux Compose stack.

Private runtime configuration and backups stay outside the Git build context.
Usage: python3 scripts/deploy-compose-release.py PHASE SOURCE LIVE ENV RELEASE SHA
Phases: prepare, build, backup, migrate, activate, rollback.
Run with the same Docker access and user as the existing stack.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

DEFAULT_BACKUP_COMPRESSION = '1'
DEFAULT_MIN_FREE_GIB = 15


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def output(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs)


def compose(runtime, file):
    config = json.loads((runtime / file).read_text())
    return ['docker', 'compose', '-p', config['name'], '-f', str(runtime / file)]


def literal_config(value):
    # Resolved secrets must not undergo Compose variable interpolation again.
    if isinstance(value, str):
        return value.replace('$', '$$')
    if isinstance(value, dict):
        return {k: literal_config(v) for k, v in value.items()}
    if isinstance(value, list):
        return [literal_config(v) for v in value]
    return value


def resolve_backup_compression(env=None):
    source_env = os.environ if env is None else env
    compression = source_env.get('DEPLOY_BACKUP_COMPRESSION', DEFAULT_BACKUP_COMPRESSION)
    if compression not in [str(i) for i in range(10)]:
        raise SystemExit('DEPLOY_BACKUP_COMPRESSION must be between 0 and 9.')
    return compression


def check_free_space(target_dir, min_free_gib=None, disk_usage_fn=shutil.disk_usage, extra_paths=None):
    threshold_gib = (
        float(os.environ.get('DEPLOY_MIN_FREE_GIB', str(DEFAULT_MIN_FREE_GIB)))
        if min_free_gib is None
        else float(min_free_gib)
    )
    min_bytes = int(threshold_gib * (1024 ** 3))
    paths_to_check = [Path(target_dir)]
    if extra_paths is not None:
        paths_to_check.extend(Path(p) for p in extra_paths)
    else:
        # On WSL2, Linux df reflects the virtual VHD limit rather than the Windows C: host drive.
        wsl_host_drive = Path('/mnt/c')
        if wsl_host_drive.is_dir():
            paths_to_check.append(wsl_host_drive)

    seen_devs = set()
    for check_path in paths_to_check:
        try:
            dev = check_path.stat().st_dev
            if dev in seen_devs:
                continue
            seen_devs.add(dev)
            free_bytes = disk_usage_fn(check_path).free
        except OSError:
            continue
        if free_bytes < min_bytes:
            free_gib = free_bytes / (1024 ** 3)
            raise SystemExit(
                f'Insufficient free disk space on {check_path}: {free_gib:.2f} GiB free '
                f'(need at least {threshold_gib:.1f} GiB before running database backup). '
                f'Clean up older release dumps with scripts/cleanup-release-backups.py first.'
            )


def run_backup_phase(runtime, run_fn=run, disk_usage_fn=shutil.disk_usage, env=None, extra_paths=None):
    config = json.loads((runtime / 'compose.json').read_text())
    postgres = f"{config['name']}-postgres-1"
    database = config['services']['postgres']['environment']
    dump = runtime / 'database.dump'
    if dump.exists():
        raise SystemExit('Backup already exists; preserve it and choose a new release for another backup.')
    compression = resolve_backup_compression(env)
    check_free_space(runtime, disk_usage_fn=disk_usage_fn, extra_paths=extra_paths)
    try:
        with dump.open('wb') as f:
            run_fn(
                ['docker', 'exec', postgres, 'pg_dump', '-U', database['POSTGRES_USER'], '-d', database['POSTGRES_DB'], '-Fc', '-Z', compression],
                stdout=f,
            )
        with dump.open('rb') as f:
            run_fn(['docker', 'exec', '-i', postgres, 'pg_restore', '--list'], stdin=f, stdout=subprocess.DEVNULL)
    except Exception:
        # Remove partial/unverified archive so a failed backup never leaves gigabytes of broken data on disk.
        if dump.exists() and not (runtime / 'backup-verified').exists():
            dump.unlink(missing_ok=True)
        raise
    run_fn(['docker', 'exec', f"{config['name']}-redis-1", 'redis-cli', 'BGSAVE'])
    (runtime / 'backup-verified').write_text(str(dump.stat().st_size))
    print(f'PostgreSQL backup verified ({dump.stat().st_size} bytes, -Z {compression}); existing volumes retained.')


def main(argv=None):
    os.umask(0o077)
    args = sys.argv[1:] if argv is None else argv
    phase, source_arg, live_arg, env_arg, release_arg, sha = args
    source, live, release = map(lambda s: Path(s).resolve(), (source_arg, live_arg, release_arg))
    if len(sha) != 40 or any(c not in '0123456789abcdef' for c in sha):
        raise SystemExit('A full committed SHA is required.')
    image = f'growthx-crawler:{sha}'
    runtime = release / 'runtime'

    if phase == 'prepare':
        if release.exists():
            raise SystemExit('Choose an unused release directory; previous releases are preserved.')
        release.mkdir(parents=True)
        runtime.mkdir()
        checkout = release / 'source'
        checkout.mkdir()
        archive = runtime / 'source.tar'
        with archive.open('wb') as f:
            run(['git', '-C', str(source), 'archive', sha], stdout=f)
        with tarfile.open(archive) as tar:
            tar.extractall(checkout, filter='data')
        live_compose_cmd = ['docker', 'compose', '--env-file', env_arg]
        if (live / 'compose.json').is_file() and 'COMPOSE_FILE' not in os.environ:
            live_compose_cmd += ['-f', str(live / 'compose.json')]
        live_compose_cmd += ['config', '--format', 'json']
        config = json.loads(output(live_compose_cmd, cwd=live))
        source_config = json.loads(output([
            'docker', 'compose', '--env-file', env_arg, '-f', str(checkout / 'docker-compose.yml'),
            'config', '--format', 'json',
        ], cwd=checkout))
        for service in ['api', 'worker']:
            container = json.loads(output(['docker', 'inspect', f"{config['name']}-{service}-1"]))[0]
            config['services'][service].pop('build', None)
            config['services'][service]['image'] = container['Image']
            config['services'][service]['environment'] = dict(v.split('=', 1) for v in container['Config']['Env'])
        (runtime / 'rollback.json').write_text(json.dumps(literal_config(config)))
        for service in ['api', 'worker']:
            config['services'][service]['image'] = image
            config['services'][service]['stop_grace_period'] = '15m' if service == 'worker' else '1m'
            # Preserve private/runtime variables while applying keys and defaults
            # declared by this committed release. Otherwise a newly added provider
            # key stays absent forever because only the old container env is copied.
            config['services'][service]['environment'].update(source_config['services'][service]['environment'])
            config['services'][service]['environment'].update(GIT_COMMIT=sha, GIT_BRANCH='main', WORKER_MODE=str(service == 'worker').lower())
        (runtime / 'compose.json').write_text(json.dumps(literal_config(config)))
        print(f'Prepared committed release {sha}; private settings preserved.')
    elif phase == 'build':
        context = release / 'source' / 'growthx-ai-crawler'
        # Serialize the expensive dependency stages on small hosts.
        for target in ['deps', 'prod-deps', 'runner']:
            run(['docker', 'build', '--target', target, '--label', f'org.opencontainers.image.revision={sha}', '-t', image if target == 'runner' else f'{image}-{target}', str(context)])
    elif phase == 'backup':
        run_backup_phase(runtime)
    elif phase == 'migrate':
        if not (runtime / 'backup-verified').exists():
            raise SystemExit('Run and verify backup first.')
        run(compose(runtime, 'compose.json') + ['run', '--rm', '--no-deps', 'api', 'node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy'])
        (runtime / 'migrated').write_text(sha)
    elif phase == 'activate':
        if not (runtime / 'migrated').exists():
            raise SystemExit('Apply migrations first.')
        run(compose(runtime, 'compose.json') + ['up', '-d', '--no-deps', '--no-build', 'api', 'worker'])
        print('API and worker started. Verify health and queue recovery before deploying the frontend.')
    elif phase == 'rollback':
        run(compose(runtime, 'rollback.json') + ['up', '-d', '--no-deps', '--no-build', 'api', 'worker'])
        print('Previous images restored. Additive database tables have been retained.')
    else:
        raise SystemExit('Unknown phase.')


if __name__ == '__main__':
    main()

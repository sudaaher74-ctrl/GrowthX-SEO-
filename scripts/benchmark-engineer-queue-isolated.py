"""Exercise queue capacity without accessing production Redis, database or AI."""
import pathlib, subprocess, sys, uuid
image = sys.argv[1]
network = 'engineer-benchmark-' + uuid.uuid4().hex[:12]
redis = network + '-redis'
scripts = pathlib.Path(__file__).resolve().parents[1] / 'growthx-ai-crawler' / 'scripts'
created = False
subprocess.run(['docker', 'network', 'create', network], check=True, stdout=subprocess.DEVNULL)
try:
    subprocess.run(['docker', 'run', '-d', '--name', redis, '--network', network, 'redis:7-alpine', 'redis-server', '--appendonly', 'no'], check=True, stdout=subprocess.DEVNULL)
    created = True
    subprocess.run(['docker', 'run', '--rm', '--network', network, '-e', 'NODE_PATH=/app/node_modules', '-e', 'BENCHMARK_ISOLATED=true', '-e', 'BENCHMARK_REDIS_HOST='+redis, '-v', str(scripts)+':/benchmark:ro', '--entrypoint', 'node', image, '/benchmark/benchmark-engineer-queue.cjs'], check=True)
finally:
    if created: subprocess.run(['docker', 'rm', '-f', redis], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['docker', 'network', 'rm', network], check=True, stdout=subprocess.DEVNULL)

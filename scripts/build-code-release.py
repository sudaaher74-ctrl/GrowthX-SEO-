#!/usr/bin/env python3
"""Build a source-backed, code-only image with already-installed runtime dependencies."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
artifact, source = map(lambda value: Path(value).resolve(),sys.argv[1:])
metadata=json.loads((artifact/'revision.json').read_text(encoding='utf-8-sig'))
def git(*args): return subprocess.check_output(['git','-C',str(source),*args],text=True).strip()
sha=metadata['commit'];base=metadata['baseCommit']
if not all(re.fullmatch('[a-f0-9]{40}',value) for value in [sha,base]): raise SystemExit('Invalid revision.')
if git('rev-parse',sha+':growthx-ai-crawler')!=metadata['sourceTree']: raise SystemExit('Source tree mismatch.')
paths=['growthx-ai-crawler/package.json','growthx-ai-crawler/package-lock.json','growthx-ai-crawler/prisma','growthx-ai-crawler/Dockerfile','growthx-ai-crawler/docker-entrypoint.sh']
if git('diff','--name-only',base,sha,'--',*paths): raise SystemExit('Runtime/schema changes require a full image build.')
expected=git('show',sha+':growthx-ai-crawler/Dockerfile.code-release').replace('\r\n','\n').lstrip('\ufeff').strip()
if (artifact/'Dockerfile').read_text(encoding='utf-8-sig').replace('\r\n','\n').strip()!=expected: raise SystemExit('Image recipe does not match committed source.')
for name,digest in metadata['files'].items():
    path=(artifact/name).resolve()
    if not path.is_relative_to(artifact/'dist') or hashlib.sha256(path.read_bytes()).hexdigest()!=digest: raise SystemExit('Artifact integrity check failed.')
base_image='growthx-crawler:'+base
info=json.loads(subprocess.check_output(['docker','image','inspect',base_image],text=True))[0]
if info['Config']['Labels'].get('org.opencontainers.image.revision')!=base: raise SystemExit('Base image revision mismatch.')
subprocess.run(['docker','build','--pull=false','--build-arg','RUNTIME_BASE='+info['Id'],'--build-arg','GIT_COMMIT='+sha,'-t','growthx-crawler:'+sha,str(artifact)],check=True)
print('Verified code release image: '+sha)

"""Stage reviewed allocations, or persist them after explicit owner approval.

stage RELEASE: changes only the unactivated candidate's Compose configuration.
persist ENV: updates these non-secret settings while retaining a private backup.
"""
import json
import os
from pathlib import Path
import re
import sys

mode, target_arg = sys.argv[1:]
target = Path(target_arg).resolve()
settings = json.loads((Path(__file__).resolve().parents[1] / 'config/investor-analysis-budget.json').read_text())
assert settings['AI_PLATFORM_MONTHLY_INR'] == 1000
assert settings['AI_CUSTOMER_MONTHLY_INR'] == sum(settings[k] for k in ['AI_INTERNAL_MONTHLY_INR', 'AI_VISIBILITY_MONTHLY_INR', 'AI_FIX_ENGINE_MONTHLY_INR'])
os.umask(0o077)
if mode == 'stage':
    assert target.is_relative_to('/home/growthx/releases')
    path = target / 'runtime/compose.json'
    original = path.read_text()
    config = json.loads(original)
    for service in ['api', 'worker']:
        env = config['services'][service]['environment']
        assert int(env['AI_PLATFORM_MONTHLY_INR']) == 1000
        env.update({key: str(value) for key, value in settings.items()})
    backup = path.with_name('compose.before-budget.json')
    if backup.exists():
        raise SystemExit('Candidate settings were already staged; previous copy retained.')
    backup.write_text(original)
    path.write_text(json.dumps(config))
elif mode == 'persist':
    assert target == Path('/home/growthx/GrowthX-SEO/.env.laptop')
    original = target.read_text()
    backup = target.with_name('.env.before-investor-allocation')
    if not backup.exists():
        backup.write_text(original)
        backup.chmod(0o600)
    text = original
    for key, value in settings.items():
        line = f'{key}={value}'
        text = re.sub(rf'^{key}=.*$', line, text, flags=re.M) if re.search(rf'^{key}=', text, re.M) else text.rstrip() + '\n' + line + '\n'
    target.write_text(text)
else:
    raise SystemExit('Use stage RELEASE or persist ENV.')
print(json.dumps({'mode': mode, 'reviewedSettings': settings}))

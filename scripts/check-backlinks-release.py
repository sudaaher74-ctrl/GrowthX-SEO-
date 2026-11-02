#!/usr/bin/env python3
"""Read-only release probe: verify health and the authenticated Backlinks route.

Usage: python3 scripts/check-backlinks-release.py API_BASE_URL EXPECTED_COMMIT
No token is needed; a registered, protected endpoint must return 401, not 404.
This never refreshes DataForSEO or creates a provider charge.
"""
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

base, revision = sys.argv[1:]
headers = {'User-Agent': 'Mozilla/5.0 GrowthX-Desktop-Verification', 'Accept': 'application/json'}

with urlopen(Request(base.rstrip('/') + '/health', headers=headers), timeout=30) as response:
    health = json.load(response)
    if health.get('status') != 'ok' or health.get('commit') != revision:
        raise SystemExit('API health does not identify the expected release.')

route = '/api/projects/00000000-0000-0000-0000-000000000000/backlinks/intelligence'
try:
    with urlopen(Request(base.rstrip('/') + route, headers=headers), timeout=30) as response:
        raise SystemExit('Backlinks intelligence unexpectedly accepted an unauthenticated request.')
except HTTPError as error:
    if error.code != 401:
        raise SystemExit(f'Backlinks intelligence returned HTTP {error.code}; expected the protected route (401).')

print('PASS: expected API release is healthy and Backlinks intelligence is registered and protected.')

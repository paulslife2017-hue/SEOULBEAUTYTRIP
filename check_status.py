#!/usr/bin/env python3
import os, requests
GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = 'https://seoulbeautytrip.com'
H = {'Content-Type': 'application/json', 'x-admin-token': GSK_TOKEN}
shops = requests.get(f'{SITE_URL}/api/shops?limit=200', headers=H, timeout=20).json().get('shops', [])
targets = [s for s in shops if s.get('name') and (
    len(s.get('description','')) < 400
    or 'destination in' in s.get('description','')
)]
print(f'처리 대상: {len(targets)}개')
for s in targets:
    print(f"  {s['name'][:35]:35} | {len(s.get('description','')):4}자 | {s.get('description','')[:50]}")

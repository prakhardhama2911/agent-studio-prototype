"""Copy the three demo sub-agent packages using a tenant-scoped, read-only query.

Run with the backend virtualenv Python; never starts the backend or runs migrations.
Credentials stay in memory and are never included in the snapshot or console output.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

from dotenv import dotenv_values
import psycopg
from psycopg.rows import dict_row

root = Path(__file__).resolve().parents[1]
backend = root.parent / 'cp-alchemy-agent-v2'
values = dotenv_values(backend / '.env')
config = json.loads((backend / 'config.json').read_text(encoding='utf-8'))
uri = values.get('POSTGRES_URI')
tenant = values.get('AGENT_TENANT_ID')
workspace = values.get('AGENT_WORKSPACE_ID') or config['database']['workspace_id']
if not uri or not tenant or not workspace:
    sys.exit('A database connection and explicit tenant/workspace are required; no data was read.')

pairs = {'distribution': 'pqa-analysis', 'general-data': 'ad-hoc-analysis', 'market-overview': 'category-market-segments'}
try:
    with psycopg.connect(uri, connect_timeout=8, options='-c default_transaction_read_only=on -c statement_timeout=15000', row_factory=dict_row) as connection:
        connection.read_only = True
        rows = connection.execute('''
            SELECT a.agent_key, s.skill_key, s.name, sf.relative_path, sf.content
            FROM bbai_agent.agents a
            JOIN bbai_agent.skills s ON s.agent_id = a.id
            JOIN bbai_agent.skill_files sf ON sf.skill_id = s.id
            WHERE a.workspace_id = %s AND a.tenant_id = %s
              AND a.agent_key = ANY(%s) AND s.skill_key = ANY(%s)
              AND a.status = 'active' AND a.deleted_at IS NULL
              AND s.status = 'active' AND s.deleted_at IS NULL
              AND sf.deleted_at IS NULL
            ORDER BY a.agent_key, s.skill_key, sf.relative_path
        ''', (workspace, tenant, list(pairs), list(pairs.values()))).fetchall()
except Exception as error:
    sys.exit(f'Read-only package snapshot unavailable ({type(error).__name__}). No database changes were attempted.')

packages = {}
for row in rows:
    if pairs.get(row['agent_key']) != row['skill_key']:
        continue
    path = row['relative_path']
    if not path or path.startswith('/') or '\\' in path or any(part in ('', '.', '..') for part in path.split('/')):
        sys.exit('An invalid package path was returned; no snapshot was written.')
    package = packages.setdefault(row['skill_key'], {'agentId': row['agent_key'], 'skillId': row['skill_key'], 'name': row['name'], 'files': {}})
    package['files'][path] = row['content']
if len(packages) != len(pairs) or any('SKILL.md' not in package['files'] for package in packages.values()):
    sys.exit('Not all three active packages contain SKILL.md; no snapshot was written.')
output = root / 'src/subagent-skill-packages.json'
output.write_text(json.dumps({'source': 'Database snapshot', 'capturedAt': datetime.now(timezone.utc).isoformat(), 'packages': packages}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for skill_id, package in packages.items():
    print(f"{skill_id}: {len(package['files'])} package files copied.")

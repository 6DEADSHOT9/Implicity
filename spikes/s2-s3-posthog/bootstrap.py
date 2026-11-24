import json
import subprocess
from pathlib import Path

root = Path(__file__).parent
code = r'''import json, secrets
from posthog.models import User, PersonalAPIKey, Team
from posthog.models.utils import hash_key_value

email = 'spike-owner@implicity.local'
team_name = 'S2 S3 PostHog Spike'
user = User.objects.filter(email=email).first()
if user is None:
    _, team, user = User.objects.bootstrap(
        organization_name=team_name, email=email, password=secrets.token_urlsafe(32),
        first_name='Spike', team_fields={'name': team_name},
    )
else:
    team = Team.objects.get(name=team_name, organization__name=team_name)
key = 'phx_' + secrets.token_urlsafe(32)
PersonalAPIKey.objects.create(
    secure_value=hash_key_value(key), user=user, label='S2 S3 spike', mask_value=key[-4:],
    scopes=['query:read', 'endpoint:read', 'endpoint:write', 'insight_variable:write'], scoped_teams=[team.pk],
)
print(json.dumps({'project_id': team.pk, 'project_key': team.api_token, 'personal_key': key}))'''
result = subprocess.run(
    ['docker', 'exec', '-i', 's2-s3-posthog-web-1', 'sh', '-c',
     '. /run/posthog-secrets/environment && python manage.py shell'],
    input=code, capture_output=True, text=True,
)
if result.returncode:
    raise SystemExit(result.stderr or result.stdout)
values = json.loads(result.stdout.strip().splitlines()[-1])
env = root / '.env'
lines = [line for line in env.read_text().splitlines() if not line.startswith(('POSTHOG_HOST=', 'POSTHOG_PROJECT_ID=', 'POSTHOG_PROJECT_KEY=', 'POSTHOG_PERSONAL_KEY='))]
lines.extend([
    'POSTHOG_HOST=http://127.0.0.1:8010',
    f"POSTHOG_PROJECT_ID={values['project_id']}",
    f"POSTHOG_PROJECT_KEY={values['project_key']}",
    f"POSTHOG_PERSONAL_KEY={values['personal_key']}",
])
env.write_text('\n'.join(lines) + '\n')
env.chmod(0o600)
print(f"Provisioned isolated project {values['project_id']} and wrote credentials to {env}")

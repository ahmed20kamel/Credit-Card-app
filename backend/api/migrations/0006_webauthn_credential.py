# Generated migration for WebAuthn credential model

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_card_card_benefits'),
    ]

    operations = [
        migrations.CreateModel(
            name='WebAuthnCredential',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('credential_id', models.TextField(unique=True)),
                ('public_key', models.TextField()),
                ('sign_count', models.IntegerField(default=0)),
                ('device_name', models.CharField(blank=True, max_length=255, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webauthn_credentials', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'webauthn_credentials',
                'indexes': [
                    models.Index(fields=['user_id'], name='api_webauthn_user_id_idx'),
                ],
            },
        ),
    ]

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_add_issue_date_classification'),
    ]

    operations = [
        migrations.CreateModel(
            name='BankPassword',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('bank_name', models.CharField(max_length=100)),
                ('password_encrypted', models.BinaryField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bank_passwords', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'bank_passwords',
                'indexes': [models.Index(fields=['user_id'], name='bank_pass_user_idx')],
            },
        ),
        migrations.AlterUniqueTogether(
            name='bankpassword',
            unique_together={('user', 'bank_name')},
        ),
    ]

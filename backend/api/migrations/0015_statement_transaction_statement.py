import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_card_points_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Statement',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('bank_name', models.CharField(max_length=100)),
                ('card_name', models.CharField(blank=True, max_length=255, null=True)),
                ('card_last_four', models.CharField(blank=True, max_length=4, null=True)),
                ('cardholder_name', models.CharField(blank=True, max_length=255, null=True)),
                ('statement_period_from', models.DateField(blank=True, null=True)),
                ('statement_period_to', models.DateField(blank=True, null=True)),
                ('statement_balance', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('available_balance', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('credit_limit', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('payment_due_full_date', models.DateField(blank=True, null=True)),
                ('payment_due_day', models.IntegerField(blank=True, null=True)),
                ('minimum_payment', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('currency', models.CharField(default='AED', max_length=3)),
                ('transactions_imported', models.IntegerField(default=0)),
                ('transactions_skipped', models.IntegerField(default=0)),
                ('imported_at', models.DateTimeField(auto_now_add=True)),
                ('card', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='statements', to='api.card')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='statements', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'statements', 'ordering': ['-imported_at']},
        ),
        migrations.AddIndex(
            model_name='statement',
            index=models.Index(fields=['user_id'], name='statements_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='statement',
            index=models.Index(fields=['card_id'], name='statements_card_id_idx'),
        ),
        migrations.AddField(
            model_name='transaction',
            name='statement',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='transactions', to='api.statement'),
        ),
    ]

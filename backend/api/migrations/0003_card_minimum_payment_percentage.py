# Generated migration for minimum_payment_percentage

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_card_credit_limit_card_current_balance_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='minimum_payment_percentage',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Min payment as % of amount due (e.g. 5 for 5%), varies by bank', max_digits=5, null=True),
        ),
    ]

# Generated migration for adding deposit transaction type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_card_minimum_payment_percentage'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaction',
            name='transaction_type',
            field=models.CharField(
                choices=[
                    ('purchase', 'Purchase'),
                    ('withdrawal', 'Withdrawal'),
                    ('payment', 'Payment'),
                    ('refund', 'Refund'),
                    ('transfer', 'Transfer'),
                    ('deposit', 'Deposit'),
                ],
                max_length=50,
            ),
        ),
    ]

# Generated migration for adding card_benefits field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_alter_transaction_transaction_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='card_benefits',
            field=models.TextField(blank=True, help_text='JSON array of card benefits/features', null=True),
        ),
    ]

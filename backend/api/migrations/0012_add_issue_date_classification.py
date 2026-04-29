from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_add_contact_replacement_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='issue_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='card',
            name='classification',
            field=models.CharField(
                blank=True,
                choices=[
                    ('personal', 'Personal'),
                    ('travel', 'Travel'),
                    ('business', 'Business'),
                    ('rewards', 'Rewards'),
                ],
                max_length=50,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='card',
            name='card_type',
            field=models.CharField(
                choices=[
                    ('credit', 'Credit'),
                    ('debit', 'Debit'),
                    ('prepaid', 'Prepaid'),
                    ('covered', 'Covered'),
                ],
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='card',
            name='card_category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('classic', 'Classic'),
                    ('silver', 'Silver'),
                    ('gold', 'Gold'),
                    ('platinum', 'Platinum'),
                    ('signature', 'Signature'),
                    ('infinite', 'Infinite'),
                    ('titanium', 'Titanium'),
                    ('business', 'Business'),
                    ('world', 'World'),
                    ('world_elite', 'World Elite'),
                ],
                max_length=50,
                null=True,
            ),
        ),
    ]

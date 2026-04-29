from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_bankpassword'),
    ]

    operations = [
        migrations.AddField(
            model_name='card',
            name='points_earn_rate',
            field=models.FloatField(blank=True, default=1.0,
                help_text='Points earned per 1 AED spent', null=True),
        ),
        migrations.AddField(
            model_name='card',
            name='points_value_fils',
            field=models.FloatField(blank=True, default=5.0,
                help_text='Value of 1 point in fils (5 = 0.005 AED per point)', null=True),
        ),
    ]

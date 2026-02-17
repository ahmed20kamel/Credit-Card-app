"""Create a test user for login. Run: python manage.py create_test_user"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

TEST_EMAIL = 'test@cardvault.local'
TEST_PASSWORD = 'TestPass123!'


class Command(BaseCommand):
    help = 'Create test user: ' + TEST_EMAIL + ' / ' + TEST_PASSWORD

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=TEST_EMAIL,
            defaults={'full_name': 'Test User', 'preferred_language': 'en'}
        )
        user.set_password(TEST_PASSWORD)
        user.is_active = True
        user.save()
        if created:
            self.stdout.write(self.style.SUCCESS('Test user created.'))
        else:
            self.stdout.write('Test user already exists; password updated.')
        self.stdout.write(self.style.SUCCESS('Email: %s' % TEST_EMAIL))
        self.stdout.write(self.style.SUCCESS('Password: %s' % TEST_PASSWORD))
        self.stdout.write('Use these to log in at http://localhost:3003')

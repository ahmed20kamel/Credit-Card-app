#!/usr/bin/env bash
# Render build script for Django backend
set -o errexit

python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate --noinput

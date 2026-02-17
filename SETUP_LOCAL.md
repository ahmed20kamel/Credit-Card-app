# تشغيل المشروع محلياً بدون Docker

## المتطلبات
- Python 3.12+
- Node.js 20+
- PostgreSQL (أو استخدم SQLite للتطوير)

## خطوات التشغيل

### 1. إعداد Backend

```powershell
cd backend

# إنشاء virtual environment
python -m venv venv

# تفعيل virtual environment
.\venv\Scripts\Activate.ps1

# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل migrations
python manage.py migrate

# إنشاء superuser (اختياري)
python manage.py createsuperuser

# تشغيل السيرفر
python manage.py runserver
```

Backend سيعمل على: http://localhost:8000

### 2. إعداد Frontend

افتح terminal جديد:

```powershell
cd frontend

# تثبيت المتطلبات
npm install

# تشغيل السيرفر
npm run dev
```

Frontend سيعمل على: http://localhost:3000

## ملاحظات

- تأكد من أن PostgreSQL يعمل إذا كنت تستخدمه
- أو غيّر في `settings.py` لاستخدام SQLite للتطوير
- تأكد من أن ملف `.env` موجود في `backend` و `frontend`

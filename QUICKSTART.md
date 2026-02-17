# دليل البدء السريع - CardVault Web

## خطوات التشغيل السريعة

### 1. إعداد ملفات البيئة

#### Backend:
```bash
cd backend
copy .env.example .env
```

عدّل ملف `.env` حسب الحاجة (خاصة `ENCRYPTION_KEY` و `SECRET_KEY`)

#### Frontend:
```bash
cd frontend
copy .env.example .env
```

### 2. تشغيل باستخدام Docker

```bash
docker-compose up --build
```

### 3. الوصول للتطبيق

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1/
- **Admin Panel**: http://localhost:8000/admin

### 4. إنشاء مستخدم Admin (اختياري)

```bash
docker-compose exec backend python manage.py createsuperuser
```

## الميزات المطابقة للتطبيق الأصلي

✅ **Authentication**
- Register / Login
- JWT Tokens
- Profile Management
- Change Password

✅ **Cards Management**
- Create/Read/Update/Delete Cards
- Card Encryption (AES-GCM)
- Card Details Reveal/Hide
- Parse Card from Text
- Favorite Cards

✅ **Transactions**
- List Transactions
- Create/Update/Delete Transactions
- Monthly Summary
- Filter by Card/Date/Type

✅ **Cash Management**
- Income/Expense Entries
- Cash Balance
- List/CRUD Operations

✅ **Dashboard**
- Monthly Summary
- Cards Overview
- Quick Access

## البنية

```
cardvault_web/
├── backend/          # Django REST Framework
│   ├── api/         # API app
│   ├── cardvault/    # Django project settings
│   └── manage.py
├── frontend/         # Next.js 14
│   ├── app/          # App router
│   └── components/   # React components
└── docker-compose.yml
```

## ملاحظات مهمة

1. **التشفير**: جميع البيانات الحساسة (أرقام البطاقات، CVV) مشفرة باستخدام AES-GCM
2. **الأمان**: غير جميع المفاتيح الافتراضية في `.env` قبل الإنتاج
3. **قاعدة البيانات**: البيانات محفوظة في PostgreSQL
4. **CORS**: متاح للتطوير، قم بتقييده في الإنتاج

## استكشاف الأخطاء

### Backend لا يعمل:
- تأكد من أن PostgreSQL يعمل
- تحقق من ملف `.env`
- شغّل migrations: `python manage.py migrate`

### Frontend لا يتصل بالـ Backend:
- تحقق من `NEXT_PUBLIC_API_URL` في `.env`
- تأكد من أن Backend يعمل على المنفذ 8000

### مشاكل Docker:
- أعد بناء الصور: `docker-compose build --no-cache`
- احذف الحاويات: `docker-compose down -v`

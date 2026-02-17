# دليل النشر - Deployment Guide

## تجهيز المشروع للرفع على Git

### 1. التحقق من الملفات

تأكد من وجود الملفات التالية:
- ✅ `.gitignore` في الجذر
- ✅ `README.md` محدث
- ✅ جميع الملفات الحساسة في `.gitignore`

### 2. إعداد Git Repository

```bash
# تهيئة Git (إذا لم يكن موجوداً)
git init

# إضافة جميع الملفات
git add .

# عمل commit أولي
git commit -m "Initial commit: CardVault Web Application with RTL support"

# إضافة remote repository
git remote add origin <YOUR_REPO_URL>

# رفع الكود
git push -u origin main
```

### 3. متغيرات البيئة المطلوبة

#### Backend (.env):
```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com
DATABASE_URL=postgresql://user:password@localhost:5432/cardvault
```

#### Frontend (.env.local):
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 4. النشر على Vercel (Frontend)

1. اربط المشروع مع Vercel
2. أضف متغيرات البيئة
3. Vercel سيقوم بالبناء تلقائياً

### 5. النشر على Railway/Render (Backend)

1. اربط المشروع
2. أضف متغيرات البيئة
3. قم بتشغيل migrations:
   ```bash
   python manage.py migrate
   python manage.py collectstatic
   ```

## ملاحظات الأمان

- ⚠️ لا ترفع ملفات `.env` على Git
- ⚠️ استخدم HTTPS في الإنتاج
- ⚠️ غير جميع المفاتيح الافتراضية
- ⚠️ فعّل CORS بشكل صحيح

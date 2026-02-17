# إعداد التطوير المحلي - CardVault Backend

## الإعداد السريع (SQLite - موصى به)

1. **نسخ ملف البيئة:**
   ```powershell
   cd backend
   copy .env.example .env
   ```

2. **ملف `.env` جاهز بالفعل للإعدادات المحلية:**
   - `USE_SQLITE=True` (افتراضي)
   - `POSTGRES_HOST=localhost`

3. **تثبيت المتطلبات:**
   ```powershell
   pip install -r requirements.txt
   ```

4. **تشغيل Migrations:**
   ```powershell
   python manage.py migrate
   ```

5. **تشغيل السيرفر:**
   ```powershell
   python manage.py runserver
   ```

السيرفر سيعمل على: **http://localhost:8000**

---

## استخدام PostgreSQL محلياً

إذا كنت تريد استخدام PostgreSQL محلياً:

1. **عدّل ملف `.env`:**
   ```
   USE_SQLITE=False
   POSTGRES_HOST=localhost
   POSTGRES_DB=cardvault
   POSTGRES_USER=cardvault
   POSTGRES_PASSWORD=cardvault_dev_pass
   POSTGRES_PORT=5432
   ```

2. **تأكد من تشغيل PostgreSQL**

3. **شغّل migrations:**
   ```powershell
   python manage.py migrate
   ```

---

## استخدام Docker

1. **عدّل ملف `.env`:**
   ```
   USE_SQLITE=False
   POSTGRES_HOST=db
   ```

2. **شغّل Docker Compose:**
   ```powershell
   docker compose up
   ```

---

## ملاحظات

- **SQLite** هو الخيار الافتراضي للتطوير المحلي (لا يحتاج تثبيت)
- **PostgreSQL** مطلوب فقط إذا كنت تستخدم Docker أو تريد PostgreSQL محلياً
- جميع الإعدادات موجودة في `.env.example` مع تعليقات واضحة

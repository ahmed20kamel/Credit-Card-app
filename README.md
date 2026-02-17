# CardVault Web Application

نسخة ويب من تطبيق CardVault باستخدام Next.js و Django.

## البنية

- **Backend**: Django REST Framework
- **Frontend**: Next.js 14
- **Database**: PostgreSQL

## المتطلبات

- Docker & Docker Compose
- Node.js (للتطوير المحلي)
- Python 3.12+ (للتطوير المحلي)

## التشغيل

### باستخدام Docker (موصى به)

1. أنشئ ملف `.env` في مجلد `backend`:

```bash
cd backend
cp .env.example .env
```

2. عدّل ملف `.env` حسب الحاجة

3. شغّل المشروع:

```bash
docker-compose up --build
```

4. افتح المتصفح:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Admin Panel: http://localhost:8000/admin

### للتطوير المحلي

#### Backend:

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

#### Frontend:

```bash
cd frontend
npm install
npm run dev
```

## الميزات

- ✅ Authentication (Login, Register)
- ✅ Cards Management (CRUD)
- ✅ Transactions
- ✅ Cash Entries
- ✅ Dashboard with Summary
- ✅ Card Encryption
- ✅ JWT Authentication
- ✅ **Multi-language Support (English/Arabic)**
- ✅ **RTL (Right-to-Left) Support for Arabic**
- ✅ **Dark Mode Support**
- ✅ **Professional & Modern UI Design**
- ✅ **Responsive Design**
- ✅ **SMS Parser for Transactions**
- ✅ **Bulk Actions**

## API Endpoints

- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get Profile
- `GET /api/v1/cards` - List Cards
- `POST /api/v1/cards` - Create Card
- `GET /api/v1/cards/{id}` - Get Card
- `PUT /api/v1/cards/{id}` - Update Card
- `DELETE /api/v1/cards/{id}` - Delete Card

## ملاحظات

- البيانات الحساسة (أرقام البطاقات، CVV) مشفرة في قاعدة البيانات
- استخدم HTTPS في الإنتاج
- غير جميع المفاتيح الافتراضية في `.env`

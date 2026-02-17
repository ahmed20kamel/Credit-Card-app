# إعدادات البورتات - Port Configuration

## البورتات الحالية

- **Frontend**: `3003`
- **Backend**: `8001`

## كيفية التشغيل

### Frontend (البورت 3003)

```powershell
cd frontend
npm run dev
```

سيعمل على: **http://localhost:3003**

### Backend (البورت 8001)

```powershell
cd backend
python manage.py runserver 8001
```

سيعمل على: **http://localhost:8001**

## تغيير البورتات

### تغيير Frontend Port

1. عدّل ملف `frontend/package.json`:
```json
"dev": "next dev -p 3003"
```

2. أو أنشئ ملف `frontend/.env.local`:
```
PORT=3003
```

### تغيير Backend Port

1. عند التشغيل، استخدم:
```powershell
python manage.py runserver 8001
```

2. أو عدّل `docker-compose.yml` إذا كنت تستخدم Docker:
```yaml
ports:
  - "8001:8000"
```

## ملاحظات

- تأكد من تحديث `NEXT_PUBLIC_API_URL` في `frontend/.env.local` إذا غيرت Backend port
- إذا كنت تستخدم Docker، عدّل `docker-compose.yml` أيضاً

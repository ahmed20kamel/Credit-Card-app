# دليل التثبيت - CardVault Web

## المتطلبات المطلوبة

يجب تثبيت أحد الخيارات التالية:

### الخيار 1: Docker Desktop (موصى به - الأسهل) ⭐

1. **تحميل Docker Desktop:**
   - اذهب إلى: https://www.docker.com/products/docker-desktop/
   - حمّل Docker Desktop for Windows
   - ثبّت الملف

2. **بعد التثبيت:**
   ```powershell
   cd "C:\Users\devops\Desktop\mobile app\cardvault_web"
   docker compose up --build
   ```

3. **الوصول للتطبيق:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

---

### الخيار 2: تثبيت Python و Node.js

#### أ. تثبيت Python

1. **تحميل Python:**
   - اذهب إلى: https://www.python.org/downloads/
   - حمّل Python 3.12 أو أحدث
   - **مهم:** عند التثبيت، تأكد من تفعيل "Add Python to PATH"

2. **التحقق من التثبيت:**
   ```powershell
   python --version
   pip --version
   ```

#### ب. تثبيت Node.js

1. **تحميل Node.js:**
   - اذهب إلى: https://nodejs.org/
   - حمّل LTS version (20.x أو أحدث)
   - ثبّت الملف

2. **التحقق من التثبيت:**
   ```powershell
   node --version
   npm --version
   ```

#### ج. تثبيت PostgreSQL (اختياري - يمكن استخدام SQLite)

1. **تحميل PostgreSQL:**
   - اذهب إلى: https://www.postgresql.org/download/windows/
   - حمّل وثبّت PostgreSQL 16

2. **أو استخدم SQLite (أسهل للتطوير):**
   - لا حاجة لتثبيت شيء
   - عدّل ملف `backend/.env`:
     ```
     USE_SQLITE=True
     POSTGRES_HOST=localhost
     ```

#### د. تشغيل المشروع

**Backend:**
```powershell
cd "C:\Users\devops\Desktop\mobile app\cardvault_web\backend"

# إنشاء virtual environment
python -m venv venv

# تفعيل virtual environment
.\venv\Scripts\Activate.ps1

# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل migrations
python manage.py migrate

# تشغيل السيرفر
python manage.py runserver
```

**Frontend (Terminal جديد):**
```powershell
cd "C:\Users\devops\Desktop\mobile app\cardvault_web\frontend"

# تثبيت المتطلبات
npm install

# تشغيل السيرفر
npm run dev
```

---

### الخيار 3: استخدام WSL (Windows Subsystem for Linux)

إذا كان لديك WSL مثبت:

```bash
# في WSL
cd /mnt/c/Users/devops/Desktop/mobile\ app/cardvault_web

# تثبيت Python و Node.js في WSL
sudo apt update
sudo apt install python3 python3-pip nodejs npm postgresql

# ثم اتبع نفس الخطوات
```

---

## ملخص سريع

**الأسهل:** تثبيت Docker Desktop ثم:
```powershell
docker compose up --build
```

**بدون Docker:** تثبيت Python + Node.js ثم اتبع خطوات الخيار 2

---

## استكشاف الأخطاء

### "python is not recognized"
- تأكد من تثبيت Python
- تأكد من تفعيل "Add Python to PATH" عند التثبيت
- أعد تشغيل PowerShell بعد التثبيت

### "docker is not recognized"
- تثبيت Docker Desktop
- تأكد من تشغيل Docker Desktop قبل استخدام الأوامر

### مشاكل في PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

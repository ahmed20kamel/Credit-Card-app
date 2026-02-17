# تشغيل التطبيق على الشبكة (بدون Docker)

حتى أي جهاز على نفس الواي فاي يقدر يفتح التطبيق من المتصفح.

## 1. تشغيل الباكند (Django)

```bash
cd backend
# إذا أول مرة: python -m venv venv && source venv/bin/activate  # أو .\venv\Scripts\Activate.ps1 على ويندوز
# pip install -r requirements.txt
# python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## 2. تشغيل الفرونت (Next.js)

في تيرمنال ثاني:

```bash
cd frontend
# إذا أول مرة: npm install
npm run dev
```

## 3. الدخول من أي جهاز على الشبكة

- من جهازك: http://localhost:8080
- من الجوال أو أي كمبيوتر على نفس الواي فاي: http://**IP-جهازك**:8080 (مثال: http://192.168.1.53:8080)

معرفة IP جهازك:
- ماك: System Settings → Network → Wi‑Fi → Details أو من التيرمنال: `ipconfig getifaddr en0`
- ويندوز: `ipconfig` وابحث عن IPv4

مثال: إذا الـ IP هو 192.168.1.53، من الجوال افتح: http://192.168.1.53:8080

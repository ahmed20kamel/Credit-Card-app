# 🚀 ابدأ من هنا - تشغيل المشروع

## ⚠️ المتطلبات المطلوبة

**يجب تثبيت Python أولاً!**

## 📥 خطوات التثبيت السريعة

### 1. تثبيت Python

1. **افتح المتصفح واذهب إلى:**
   ```
   https://www.python.org/downloads/
   ```

2. **حمّل Python 3.12 أو أحدث**

3. **عند التثبيت:**
   - ✅ **مهم جداً:** فعّل "Add Python to PATH" (في الأسفل)
   - اضغط "Install Now"

4. **بعد التثبيت:**
   - أغلق PowerShell الحالي
   - افتح PowerShell جديد

5. **تحقق من التثبيت:**
   ```powershell
   python --version
   ```
   يجب أن يظهر: `Python 3.12.x`

---

### 2. تشغيل المشروع

بعد تثبيت Python، شغّل هذه الأوامر:

```powershell
# الانتقال لمجلد Backend
cd "C:\Users\devops\Desktop\mobile app\cardvault_web\backend"

# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل Migrations
python manage.py migrate

# تشغيل السيرفر
python manage.py runserver
```

**السيرفر سيعمل على:** http://localhost:8000

---

### 3. تشغيل Frontend (Terminal جديد)

```powershell
# الانتقال لمجلد Frontend
cd "C:\Users\devops\Desktop\mobile app\cardvault_web\frontend"

# تثبيت المتطلبات (يحتاج Node.js)
npm install

# تشغيل السيرفر
npm run dev
```

**Frontend سيعمل على:** http://localhost:3000

---

## ⚡ الخيار السريع: Docker

إذا كنت تفضل Docker (أسهل):

1. **حمّل Docker Desktop:**
   ```
   https://www.docker.com/products/docker-desktop/
   ```

2. **ثبّت وأعد تشغيل الكمبيوتر**

3. **شغّل:**
   ```powershell
   cd "C:\Users\devops\Desktop\mobile app\cardvault_web"
   docker compose up --build
   ```

---

## ❓ استكشاف الأخطاء

### "python is not recognized"
- تأكد من تثبيت Python
- تأكد من تفعيل "Add Python to PATH"
- **أعد فتح PowerShell** بعد التثبيت

### "pip is not recognized"
- تأكد من تثبيت Python بشكل صحيح
- أعد فتح PowerShell

### مشاكل في PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## ✅ بعد التثبيت

المشروع جاهز! فقط:
1. ثبّت Python
2. شغّل الأوامر أعلاه
3. افتح http://localhost:8000

# 🔧 TOOLBOX BACKEND - GUÍA RÁPIDA

## 📁 QUÉ HAY AQUÍ

```
backend/
├── app.py              ← ARCHIVO PRINCIPAL (todos los endpoints)
├── config.py           ← Configuración (Supabase, secretos)
├── requirements.txt    ← Librerías necesarias
├── .env                ← Credenciales secretas (NO subir a GitHub)
├── .env.example        ← Plantilla de .env
└── .gitignore          ← Le dice a Git qué no subir
```

---

## ⚙️ SETUP (Una sola vez)

### **Paso 1: Copiar .env.example → .env**

En tu terminal:
```powershell
copy .env.example .env
```

Ahora edita `.env` y llena:
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=eyJ... (tu API key)
SECRET_KEY=una-frase-aleatoria
```

**¿Dónde obtenerlo?**
- Ve a Supabase → Dashboard
- Settings (izquierda) → API
- Copia "Project URL" y "anon public"

### **Paso 2: Instalar librerías**

```powershell
pip install -r requirements.txt
```

Espera 2-3 minutos.

### **Paso 3: Verificar que funciona**

```powershell
python app.py
```

Deberías ver:
```
✅ Conectado a Supabase
🚀 Backend corriendo en https://...
 * Running on http://127.0.0.1:5000
```

---

## 📝 ENDPOINTS (qué hace cada uno)

### **1. LOGIN ADMIN**
```
POST /api/login-admin

Request:
{
  "email": "manolo@toolbox.mx",
  "password": "tu-password"
}

Response:
{
  "token": "eyJ...",
  "user_id": 1,
  "role": "admin"
}
```

### **2. LOGIN ORGANIZACIÓN**
```
POST /api/login-org

Request:
{
  "email": "dueño@miempresa.com",
  "password": "su-password",
  "org_id": 1
}

Response:
{
  "token": "eyJ...",
  "user_id": 5,
  "role": "owner",
  "org_id": 1,
  "org_name": "Mi Empresa"
}
```

### **3. DASHBOARD ADMIN**
```
GET /api/dashboard-admin

Headers:
Authorization: Bearer eyJ...

Response:
{
  "total_organizations": 5,
  "total_users": 23,
  "organizations": [...]
}
```

### **4. DASHBOARD ORGANIZACIÓN**
```
GET /api/dashboard-org

Headers:
Authorization: Bearer eyJ...

Response:
{
  "org_id": 1,
  "org_name": "Mi Empresa",
  "role": "owner",
  "total_users": 5,
  "users": [...]
}
```

### **5. CREAR USUARIO**
```
POST /api/create-user

Headers:
Authorization: Bearer eyJ...

Request:
{
  "email": "empleado@miempresa.com",
  "password": "contraseña",
  "role": "employee",
  "name": "Juan"
}

Response:
{
  "user_id": 10,
  "email": "empleado@miempresa.com"
}
```

---

## 🧪 TESTEAR LOCALMENTE

Usa **Postman** o **Thunder Client** (extensión de VS Code):

1. `python app.py`
2. Abre Thunder Client
3. POST http://127.0.0.1:5000/api/login-admin
4. Body (JSON):
   ```json
   {
     "email": "test@test.com",
     "password": "test123"
   }
   ```
5. Click "Send"

---

## 🚀 DESPLEGAR A RENDER

### **Paso 1: Crear .env en Render**

En Render dashboard:
- Environment → Add Environment Variable
- Copia todo lo de tu `.env` local
- IMPORTANTE: `.env` local NO se sube a GitHub

### **Paso 2: Deploy**

Render detecta `requirements.txt` y `app.py` automáticamente.

```
python -m flask run
```

Listo.

---

## 🔐 CÓMO FUNCIONA LA SEGURIDAD

1. **Password:** Se encripta con `bcrypt` antes de guardar
2. **Token:** JWT válido 7 días
3. **Headers:** El frontend manda `Authorization: Bearer <token>`
4. **Verificación:** Cada endpoint valida el token

---

## ❓ PREGUNTAS COMUNES

**¿Dónde está la BD?**
Supabase (cloud). Render solo tiene el código.

**¿Cómo cambia el BD?**
Edita `app.py` → `supabase.table('users')...`

**¿Cómo agrego nuevos endpoints?**
```python
@app.route('/api/mi-endpoint', methods=['POST'])
def mi_endpoint():
    # tu código aquí
    return jsonify({...}), 200
```

**¿Cómo conecto con frontend?**
Frontend hace `fetch('https://tudominio/api/login-admin', {...})`

---

## 📞 CUANDO ALGO FALLA

| Error | Solución |
|-------|----------|
| `ModuleNotFoundError` | `pip install -r requirements.txt` |
| `SUPABASE_URL no configurado` | Revisa `.env` |
| `CORS error` | Agrega tu dominio a `CORS_ORIGINS` en `.env` |
| `Token inválido` | Token expiró (válido 7 días) |

---

**¿Preguntas?** Pregunta. 🚀

"""
TOOLBOX BACKEND - Flask App
============================

Este es el corazón del backend. Aquí están:
- Login (admin + organizaciones)
- Endpoints para dashboards
- Conexión a Supabase

El servidor corre en: http://127.0.0.1:5000 (local) o en Render (producción)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from dotenv import load_dotenv
import jwt
import bcrypt

load_dotenv()


from datetime import datetime, timedelta
from supabase import create_client, Client
import os

# ============================================================================
# INICIALIZAR FLASK
# ============================================================================

app = Flask(__name__)
app.config.from_object(Config)

# Permitir que Vercel (frontend) hable con este backend
CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS.split(',')}})

# ============================================================================
# CONECTAR A SUPABASE (Base de Datos)
# ============================================================================

supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)

print("✅ Conectado a Supabase")
print(f"🚀 Backend corriendo en {Config.SUPABASE_URL}")

# ============================================================================
# FUNCIONES AUXILIARES (encriptación, tokens, etc)
# ============================================================================

def hash_password(password: str) -> str:
    """Encripta una contraseña con bcrypt (seguro)"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hash: str) -> bool:
    """Verifica si una contraseña coincide con su hash"""
    return bcrypt.checkpw(password.encode(), hash.encode())

def create_token(user_id: int, email: str, role: str, org_id: int = None) -> str:
    """Crea un JWT token para la sesión del usuario"""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'org_id': org_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=7)  # Token válido 7 días
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')

def verify_token(token: str):
    """Verifica si un token es válido y devuelve los datos del usuario"""
    try:
        return jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
    except jwt.InvalidTokenError:
        return None

# ============================================================================
# ENDPOINT: HEALTH CHECK (para verificar que el servidor está vivo)
# ============================================================================

@app.route('/', methods=['GET'])
def health():
    """Verifica que el servidor está corriendo"""
    return jsonify({
        'status': '✅ Backend está vivo',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# ============================================================================
# ENDPOINT: LOGIN ADMIN
# ============================================================================

@app.route('/api/login-admin', methods=['POST'])
def login_admin():
    """
    Login para el ADMIN (Manolo + primo)
    
    Request:
    {
        "email": "manolo@toolbox.mx",
        "password": "tu-contraseña"
    }
    
    Response:
    {
        "token": "eyJ...",
        "user_id": 1,
        "email": "manolo@toolbox.mx",
        "role": "admin"
    }
    """
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        # Buscar usuario en BD
        response = supabase.table('users').select('*').eq('email', email).execute()
        
        if not response.data:
            return jsonify({'error': '❌ Email o contraseña incorrecta'}), 401
        
        user = response.data[0]
        
        # Verificar contraseña
        if not verify_password(password, user['password_hash']):
            return jsonify({'error': '❌ Email o contraseña incorrecta'}), 401
        
        # Solo admins pueden entrar aquí
        if user['role'] != 'admin':
            return jsonify({'error': '❌ No eres admin'}), 403
        
        # Crear token
        token = create_token(user['id'], user['email'], user['role'])
        
        return jsonify({
            'token': token,
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role']
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'❌ Error: {str(e)}'}), 500

# ============================================================================
# ENDPOINT: LOGIN ORGANIZACIÓN (dueño o empleado)
# ============================================================================

@app.route('/api/login-org', methods=['POST'])
def login_org():
    """
    Login para DUEÑO o EMPLEADO de una organización
    
    Request:
    {
        "email": "dueño@miempresa.com",
        "password": "contraseña",
        "org_id": 1
    }
    
    Response:
    {
        "token": "eyJ...",
        "user_id": 5,
        "email": "dueño@miempresa.com",
        "role": "owner",
        "org_id": 1,
        "org_name": "Mi Empresa"
    }
    """
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        org_id = data.get('org_id')
        
        # Buscar usuario
        if org_id:
            response = supabase.table('users').select('*').eq('email', email).eq('organization_id', org_id).execute()
        else:
            response = supabase.table('users').select('*').eq('email', email).execute()
        
        if not response.data:
            return jsonify({'error': '❌ Email o contraseña incorrecta'}), 401
        
        user = response.data[0]
        
        # Verificar contraseña
        if not verify_password(password, user['password_hash']):
            return jsonify({'error': '❌ Email o contraseña incorrecta'}), 401
        
        # Solo owner o employee pueden entrar aquí
        if user['role'] not in ['owner', 'employee']:
            return jsonify({'error': '❌ Acceso denegado'}), 403
        
        # Obtener nombre de la organización
        org_response = supabase.table('organizations').select('name').eq('id', org_id).execute()
        org_name = org_response.data[0]['name'] if org_response.data else 'Unknown'
        
        # Crear token
        token = create_token(user['id'], user['email'], user['role'], org_id)
        
        return jsonify({
            'token': token,
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'org_id': org_id,
            'org_name': org_name
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'❌ Error: {str(e)}'}), 500

# ============================================================================
# ENDPOINT: DASHBOARD ADMIN (ve TODAS las organizaciones)
# ============================================================================

@app.route('/api/dashboard-admin', methods=['GET'])
def dashboard_admin():
    """
    Dashboard para el ADMIN
    Ve: todas las organizaciones, total de usuarios, total de data
    
    Headers:
    Authorization: Bearer <token>
    
    Response:
    {
        "total_organizations": 5,
        "total_users": 23,
        "organizations": [
            {
                "id": 1,
                "name": "Cliente A",
                "owner": "Juan",
                "users_count": 5,
                "created_at": "2026-05-20"
            },
            ...
        ]
    }
    """
    try:
        # Obtener token del header
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)
        
        if not payload or payload['role'] != 'admin':
            return jsonify({'error': '❌ Token inválido o no eres admin'}), 401
        
        # Obtener todas las organizaciones
        orgs_response = supabase.table('organizations').select('*').execute()
        organizations = orgs_response.data
        
        # Para cada organización, contar usuarios
        for org in organizations:
            users_response = supabase.table('users').select('id').eq('organization_id', org['id']).execute()
            org['users_count'] = len(users_response.data)
        
        return jsonify({
            'total_organizations': len(organizations),
            'total_users': sum([org['users_count'] for org in organizations]),
            'organizations': organizations
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'❌ Error: {str(e)}'}), 500

# ============================================================================
# ENDPOINT: DASHBOARD ORGANIZACIÓN (solo datos de ESA org)
# ============================================================================

@app.route('/api/dashboard-org', methods=['GET'])
def dashboard_org():
    """
    Dashboard para DUEÑO o EMPLEADO
    Ve: solo datos de SU organización
    
    Headers:
    Authorization: Bearer <token>
    
    Response:
    {
        "org_id": 1,
        "org_name": "Mi Empresa",
        "role": "owner",
        "total_users": 5,
        "users": [
            {"id": 5, "email": "empleado1@miempresa.com", "role": "employee"},
            ...
        ]
    }
    """
    try:
        # Obtener token del header
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)
        
        if not payload or payload['role'] not in ['owner', 'employee']:
            return jsonify({'error': '❌ Token inválido'}), 401
        
        org_id = payload['org_id']
        
        # Obtener datos de la org
        org_response = supabase.table('organizations').select('*').eq('id', org_id).execute()
        org = org_response.data[0] if org_response.data else None
        
        if not org:
            return jsonify({'error': '❌ Organización no encontrada'}), 404
        
        # Obtener usuarios de la org
        users_response = supabase.table('users').select('id, email, role').eq('organization_id', org_id).execute()
        users = users_response.data
        
        return jsonify({
            'org_id': org_id,
            'org_name': org['name'],
            'role': payload['role'],
            'total_users': len(users),
            'users': users
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'❌ Error: {str(e)}'}), 500

# ============================================================================
# ENDPOINT: CREAR USUARIO (para agregar dueños/empleados a una org)
# ============================================================================

@app.route('/api/create-user', methods=['POST'])
def create_user():
    """
    Crea un nuevo usuario (dueño o empleado) en una organización
    Solo el DUEÑO de la org puede hacer esto
    
    Request:
    {
        "email": "nuempleado@miempresa.com",
        "password": "contraseña",
        "role": "employee",  // "owner" o "employee"
        "name": "Juan Pérez"
    }
    
    Headers:
    Authorization: Bearer <token>
    
    Response:
    {
        "user_id": 10,
        "email": "nuempleado@miempresa.com",
        "role": "employee"
    }
    """
    try:
        # Verificar token
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)
        
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': '❌ No tienes permisos'}), 403
        
        data = request.json
        email = data.get('email')
        password = data.get('password')
        role = data.get('role')
        name = data.get('name', '')
        
        org_id = payload['org_id']
        
        # Encriptar contraseña
        password_hash = hash_password(password)
        
        # Crear usuario en BD
        response = supabase.table('users').insert({
            'email': email,
            'password_hash': password_hash,
            'role': role,
            'organization_id': org_id,
            'name': name
        }).execute()
        
        new_user = response.data[0]
        
        return jsonify({
            'user_id': new_user['id'],
            'email': new_user['email'],
            'role': new_user['role']
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'❌ Error: {str(e)}'}), 500

# ============================================================================
# MANEJO DE ERRORES
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '❌ Endpoint no encontrado'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': '❌ Error interno del servidor'}), 500

@app.route('/api/create-admin', methods=['POST'])
def create_admin():
    """
    SOLO para desarrollo - crear un admin de prueba
    """
    try:
        email = 'manolo@toolbox.mx'
        password = 'test123'
        
        # Encriptar contraseña
        password_hash = hash_password(password)
        
        # Crear en BD
        response = supabase.table('users').insert({
            'email': email,
            'password_hash': password_hash,
            'role': 'admin',
            'name': 'Manolo'
        }).execute()
        
        return jsonify({'status': 'Admin creado', 'email': email}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/reset-password-admin', methods=['POST'])
def reset_password_admin():
    """SOLO PARA TESTING - resetea password de admin"""
    try:
        email = 'manolo@toolbox.mx'
        password = 'test123'
        password_hash = hash_password(password)
        
        response = supabase.table('users').update({
            'password_hash': password_hash
        }).eq('email', email).execute()
        
        return jsonify({'status': 'Password reset', 'password': password}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# ============================================================================
# RUN
# ============================================================================

if __name__ == '__main__':
    # Debug=True = recarga automático cuando cambias código
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
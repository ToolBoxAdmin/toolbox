"""
TOOLBOX BACKEND - Flask App
============================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from dotenv import load_dotenv
import jwt
import bcrypt
from datetime import datetime, timedelta
from supabase import create_client, Client
import os

load_dotenv()

# ============================================================================
# INICIALIZAR FLASK
# ============================================================================

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS.split(',')}})

# ============================================================================
# CONECTAR A SUPABASE
# ============================================================================

supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)

print("✅ Conectado a Supabase")

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), hash.encode())

def create_token(user_id: int, username: str, role: str, org_id: int = None) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'org_id': org_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')

def verify_token(token: str):
    try:
        return jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
    except jwt.InvalidTokenError:
        return None

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/', methods=['GET'])
def health():
    return jsonify({
        'status': '✅ Backend está vivo',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# ============================================================================
# ENDPOINT: LOGIN UNIVERSAL
# ============================================================================

@app.route('/api/login', methods=['POST'])
def login():
    """
    Login universal para todos los roles (admin, owner, employee)
    Usa username + password
    """
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        response = supabase.table('users').select('*').eq('username', username).execute()

        if not response.data:
            return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

        user = response.data[0]

        import sys
        print(f"DEBUG username: {username}", file=sys.stderr)
        print(f"DEBUG hash from DB: {user['password_hash']}", file=sys.stderr)
        print(f"DEBUG verify result: {verify_password(password, user['password_hash'])}", file=sys.stderr)

        if not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

        org_id = user.get('org_id')
        token = create_token(user['id'], user['username'], user['role'], org_id)

        return jsonify({
            'token': token,
            'user_id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'org_id': org_id
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: DASHBOARD ADMIN
# ============================================================================

@app.route('/api/dashboard-admin', methods=['GET'])
def dashboard_admin():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'Token inválido o no eres admin'}), 401

        orgs_response = supabase.table('organizations').select('*').execute()
        organizations = orgs_response.data

        for org in organizations:
            users_response = supabase.table('users').select('id').eq('org_id', org['id']).execute()
            org['users_count'] = len(users_response.data)

        return jsonify({
            'total_organizations': len(organizations),
            'total_users': sum([org['users_count'] for org in organizations]),
            'organizations': organizations
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: DASHBOARD ORGANIZACIÓN
# ============================================================================

@app.route('/api/dashboard-org', methods=['GET'])
def dashboard_org():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] not in ['owner', 'employee']:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = payload['org_id']

        org_response = supabase.table('organizations').select('*').eq('id', org_id).execute()
        org = org_response.data[0] if org_response.data else None

        if not org:
            return jsonify({'error': 'Organización no encontrada'}), 404

        users_response = supabase.table('users').select('id, username, role, full_name').eq('org_id', org_id).execute()
        users = users_response.data

        return jsonify({
            'org_id': org_id,
            'org_name': org['name'],
            'role': payload['role'],
            'total_users': len(users),
            'users': users
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: CREAR USUARIO
# ============================================================================

@app.route('/api/create-user', methods=['POST'])
def create_user():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        username = data.get('username')
        password = data.get('password')
        role = data.get('role')
        full_name = data.get('full_name', '')
        org_id = data.get('org_id') or payload.get('org_id')

        password_hash = hash_password(password)

        response = supabase.table('users').insert({
            'username': username,
            'password_hash': password_hash,
            'role': role,
            'org_id': org_id,
            'full_name': full_name
        }).execute()

        new_user = response.data[0]

        return jsonify({
            'user_id': new_user['id'],
            'username': new_user['username'],
            'role': new_user['role']
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: ELIMINAR USUARIO
# ============================================================================

@app.route('/api/delete-user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403

        supabase.table('users').delete().eq('id', user_id).execute()

        return jsonify({'status': 'Usuario eliminado'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: RESET CONTRASEÑA
# ============================================================================

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        user_id = data.get('user_id')
        new_password = data.get('new_password')

        password_hash = hash_password(new_password)

        supabase.table('users').update({
            'password_hash': password_hash
        }).eq('id', user_id).execute()

        return jsonify({'status': 'Contraseña actualizada'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: TRAER TODOS LOS USUARIOS (para dashboard admin)
# ============================================================================

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403

        users_response = supabase.table('users').select('id, username, role, full_name, org_id').execute()
        users = users_response.data

        for user in users:
            if user['org_id']:
                org_res = supabase.table('organizations').select('name').eq('id', user['org_id']).execute()
                user['org_name'] = org_res.data[0]['name'] if org_res.data else None
            else:
                user['org_name'] = None

        return jsonify({'users': users}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: CREAR ORGANIZACIÓN
# ============================================================================

@app.route('/api/create-org', methods=['POST'])
def create_org():
    try:
        token = request.headers.get('Authorization', '').split(' ')[-1]
        payload = verify_token(token)

        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        name = data.get('name')
        industry = data.get('industry', '')

        if not name:
            return jsonify({'error': 'Nombre requerido'}), 400

        slug = name.lower().replace(' ', '-')

        response = supabase.table('organizations').insert({
            'name': name,
            'slug': slug,
            'industry': industry,
            'active': True
        }).execute()

        new_org = response.data[0]

        return jsonify({
            'org_id': new_org['id'],
            'name': new_org['name'],
            'slug': new_org['slug']
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# MANEJO DE ERRORES
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500

# ============================================================================
# RUN
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
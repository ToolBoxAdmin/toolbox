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
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import os
import sys
import uuid

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
print(f"✅ Conectado a Supabase", file=sys.stderr, flush=True)

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

def get_token_payload():
    token = request.headers.get('Authorization', '').split(' ')[-1]
    return verify_token(token)

def generate_sale_id():
    """Genera un ID de venta único tipo VTA-XXXXXX"""
    return f"VTA-{uuid.uuid4().hex[:6].upper()}"

def generate_item_id():
    """Genera un ID de item único tipo SI-XXXXXXXX"""
    return f"SI-{uuid.uuid4().hex[:8].upper()}"

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
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        print(f"LOGIN ATTEMPT: username={username}", file=sys.stderr, flush=True)

        response = supabase.table('users').select('*').eq('username', username).execute()

        print(f"QUERY RESULT: {response.data}", file=sys.stderr, flush=True)

        if not response.data:
            return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

        user = response.data[0]

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
        payload = get_token_payload()
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
# ENDPOINT: DASHBOARD ORGANIZACIÓN (datos básicos)
# ============================================================================

@app.route('/api/dashboard-org', methods=['GET'])
def dashboard_org():
    try:
        payload = get_token_payload()
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
# ENDPOINT: DASHBOARD — MÉTRICAS
# ============================================================================

@app.route('/api/dashboard/metrics', methods=['GET'])
def dashboard_metrics():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')
        prev_start = request.args.get('prev_start')
        prev_end = request.args.get('prev_end')

        def get_metrics(date_start, date_end):
            res = supabase.table('sales') \
                .select('total_amount') \
                .eq('org_id', org_id) \
                .eq('status', 'completada') \
                .gte('sale_date', date_start) \
                .lte('sale_date', date_end) \
                .execute()
            rows = res.data
            total = sum(r['total_amount'] for r in rows)
            count = len(rows)
            promedio = total / count if count > 0 else 0
            return total, count, promedio

        total, count, promedio = get_metrics(start, end)
        prev_total, prev_count, prev_promedio = get_metrics(prev_start, prev_end)

        return jsonify({
            'ventas_totales': total,
            'pedidos': count,
            'ticket_promedio': round(promedio, 2),
            'ventas_totales_anterior': prev_total,
            'pedidos_anterior': prev_count,
            'ticket_promedio_anterior': round(prev_promedio, 2),
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: DASHBOARD — VENTAS POR MES (gráfica)
# ============================================================================

@app.route('/api/dashboard/ventas-chart', methods=['GET'])
def dashboard_ventas_chart():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')
        prev_start = request.args.get('prev_start')
        prev_end = request.args.get('prev_end')

        MONTHS_ES = {
            1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
            5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
            9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
        }

        def get_by_month(date_start, date_end):
            res = supabase.table('sales') \
                .select('sale_date, total_amount') \
                .eq('org_id', org_id) \
                .eq('status', 'completada') \
                .gte('sale_date', date_start) \
                .lte('sale_date', date_end) \
                .execute()
            by_month = {}
            for row in res.data:
                m = int(row['sale_date'].split('-')[1])
                by_month[m] = by_month.get(m, 0) + row['total_amount']
            return by_month

        current = get_by_month(start, end)
        previous = get_by_month(prev_start, prev_end)

        all_months = sorted(set(list(current.keys()) + list(previous.keys())))
        result = [
            {
                'mes': MONTHS_ES.get(m, str(m)),
                'ventas': round(current.get(m, 0), 2),
                'anterior': round(previous.get(m, 0), 2),
            }
            for m in all_months
        ]

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: DASHBOARD — TOP PRODUCTOS
# ============================================================================

@app.route('/api/dashboard/top-productos', methods=['GET'])
def dashboard_top_productos():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')

        # Obtener ventas del periodo
        sales_res = supabase.table('sales') \
            .select('id') \
            .eq('org_id', org_id) \
            .eq('status', 'completada') \
            .gte('sale_date', start) \
            .lte('sale_date', end) \
            .execute()

        if not sales_res.data:
            return jsonify([]), 200

        sale_ids = [s['id'] for s in sales_res.data]

        # Obtener items de esas ventas
        items_res = supabase.table('sale_items') \
            .select('product_id, quantity, subtotal') \
            .in_('sale_id', sale_ids) \
            .execute()

        # Agrupar por producto
        product_totals = {}
        for item in items_res.data:
            pid = item['product_id']
            if pid not in product_totals:
                product_totals[pid] = {'subtotal': 0, 'quantity': 0}
            product_totals[pid]['subtotal'] += item['subtotal']
            product_totals[pid]['quantity'] += item['quantity']

        if not product_totals:
            return jsonify([]), 200

        # Obtener nombres de productos
        product_ids = list(product_totals.keys())
        prods_res = supabase.table('products') \
            .select('id, name') \
            .in_('id', product_ids) \
            .execute()

        name_map = {p['id']: p['name'] for p in prods_res.data}

        result = sorted([
            {
                'product_id': pid,
                'nombre': name_map.get(pid, f'Producto {pid}'),
                'total_vendido': round(vals['subtotal'], 2),
                'unidades': int(vals['quantity']),
            }
            for pid, vals in product_totals.items()
        ], key=lambda x: x['total_vendido'], reverse=True)[:5]

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: DASHBOARD — INVENTARIO
# ============================================================================

@app.route('/api/dashboard/inventario', methods=['GET'])
def dashboard_inventario():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        res = supabase.table('products') \
            .select('stock_current, stock_min') \
            .eq('org_id', org_id) \
            .eq('active', True) \
            .execute()

        en_stock = 0
        stock_bajo = 0
        agotados = 0

        for p in res.data:
            if p['stock_current'] == 0:
                agotados += 1
            elif p['stock_current'] <= p['stock_min']:
                stock_bajo += 1
            else:
                en_stock += 1

        return jsonify([
            {'name': 'En stock',    'value': en_stock},
            {'name': 'Stock bajo',  'value': stock_bajo},
            {'name': 'Agotados',    'value': agotados},
        ]), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: VENTAS — LISTAR
# ============================================================================

@app.route('/api/ventas', methods=['GET'])
def get_ventas():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')

        query = supabase.table('sales') \
            .select('id, sale_date, total_amount, payment_method, status') \
            .eq('org_id', org_id) \
            .order('sale_date', desc=True)

        if start:
            query = query.gte('sale_date', start)
        if end:
            query = query.lte('sale_date', end)

        res = query.execute()

        return jsonify({'ventas': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: VENTAS — CREAR
# ============================================================================

@app.route('/api/ventas/crear', methods=['POST'])
def crear_venta():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        org_id = data.get('org_id')
        payment_method = data.get('payment_method', 'efectivo')
        items = data.get('items', [])

        if not items:
            return jsonify({'error': 'La venta debe tener al menos un producto'}), 400

        total = sum(i['unit_price'] * i['quantity'] for i in items)
        sale_id = generate_sale_id()
        today = date.today().isoformat()

        # Crear la venta
        supabase.table('sales').insert({
            'id': sale_id,
            'org_id': org_id,
            'sale_date': today,
            'total_amount': round(total, 2),
            'payment_method': payment_method,
            'status': 'completada',
            'created_by': payload['user_id'],
        }).execute()

        # Crear los items y actualizar stock
        for item in items:
            item_id = generate_item_id()
            subtotal = round(item['unit_price'] * item['quantity'], 2)

            supabase.table('sale_items').insert({
                'id': item_id,
                'sale_id': sale_id,
                'product_id': item['product_id'],
                'quantity': item['quantity'],
                'unit_price': item['unit_price'],
                'subtotal': subtotal,
            }).execute()

            # Descontar stock
            prod_res = supabase.table('products').select('stock_current').eq('id', item['product_id']).execute()
            if prod_res.data:
                new_stock = max(0, prod_res.data[0]['stock_current'] - item['quantity'])
                supabase.table('products').update({'stock_current': new_stock}).eq('id', item['product_id']).execute()

                # Registrar movimiento de inventario
                supabase.table('inventory_movements').insert({
                    'product_id': item['product_id'],
                    'org_id': org_id,
                    'type': 'salida',
                    'quantity': item['quantity'],
                    'reason': 'venta',
                    'sale_id': sale_id,
                    'created_by': payload['user_id'],
                }).execute()

        return jsonify({'sale_id': sale_id, 'total': round(total, 2)}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: PRODUCTOS — LISTAR
# ============================================================================

@app.route('/api/productos', methods=['GET'])
def get_productos():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        res = supabase.table('products') \
            .select('*') \
            .eq('org_id', org_id) \
            .eq('active', True) \
            .order('name') \
            .execute()

        return jsonify({'productos': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: PRODUCTOS — CREAR
# ============================================================================

@app.route('/api/productos/crear', methods=['POST'])
def crear_producto():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json

        if not data.get('name') or not data.get('unit_price'):
            return jsonify({'error': 'Nombre y precio de venta son obligatorios'}), 400

        res = supabase.table('products').insert({
            'org_id': data['org_id'],
            'name': data['name'],
            'sku': data.get('sku', ''),
            'category': data.get('category', ''),
            'unit_cost': data.get('unit_cost', 0),
            'unit_price': data['unit_price'],
            'stock_current': data.get('stock_current', 0),
            'stock_min': data.get('stock_min', 0),
            'active': True,
        }).execute()

        return jsonify({'producto': res.data[0]}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: PRODUCTOS — AGREGAR STOCK
# ============================================================================

@app.route('/api/productos/stock', methods=['POST'])
def agregar_stock():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        product_id = data.get('product_id')
        org_id = data.get('org_id')
        quantity = int(data.get('quantity', 0))

        if quantity <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

        # Obtener stock actual
        prod_res = supabase.table('products').select('stock_current').eq('id', product_id).execute()
        if not prod_res.data:
            return jsonify({'error': 'Producto no encontrado'}), 404

        new_stock = prod_res.data[0]['stock_current'] + quantity

        # Actualizar stock
        supabase.table('products').update({'stock_current': new_stock}).eq('id', product_id).execute()

        # Registrar movimiento
        supabase.table('inventory_movements').insert({
            'product_id': product_id,
            'org_id': org_id,
            'type': 'entrada',
            'quantity': quantity,
            'reason': 'compra',
            'created_by': payload['user_id'],
        }).execute()

        return jsonify({'new_stock': new_stock}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINTS EXISTENTES — sin cambios
# ============================================================================

@app.route('/api/create-user', methods=['POST'])
def create_user():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403
        data = request.json
        password_hash = hash_password(data.get('password'))
        res = supabase.table('users').insert({
            'username': data.get('username'),
            'password_hash': password_hash,
            'role': data.get('role'),
            'org_id': data.get('org_id') or payload.get('org_id'),
            'full_name': data.get('full_name', ''),
        }).execute()
        new_user = res.data[0]
        return jsonify({'user_id': new_user['id'], 'username': new_user['username'], 'role': new_user['role']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403
        supabase.table('users').delete().eq('id', user_id).execute()
        return jsonify({'status': 'Usuario eliminado'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403
        data = request.json
        password_hash = hash_password(data.get('new_password'))
        supabase.table('users').update({'password_hash': password_hash}).eq('id', data.get('user_id')).execute()
        return jsonify({'status': 'Contraseña actualizada'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        payload = get_token_payload()
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

@app.route('/api/create-org', methods=['POST'])
def create_org():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] != 'admin':
            return jsonify({'error': 'No tienes permisos'}), 403
        data = request.json
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Nombre requerido'}), 400
        slug = name.lower().replace(' ', '-')
        res = supabase.table('organizations').insert({
            'name': name, 'slug': slug,
            'industry': data.get('industry', ''), 'active': True
        }).execute()
        new_org = res.data[0]
        return jsonify({'org_id': new_org['id'], 'name': new_org['name'], 'slug': new_org['slug']}), 201
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

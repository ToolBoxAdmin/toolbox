"""
TOOLBOX BACKEND - Flask App
============================
Sprint 5: notificaciones, clientes, pedidos, gastos/finanzas,
campañas, marketplace de herramientas, perfil y vista de empleado.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from dotenv import load_dotenv
import jwt
import bcrypt
import base64
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
print("✅ Conectado a Supabase", file=sys.stderr, flush=True)

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
    return f"VTA-{uuid.uuid4().hex[:6].upper()}"

def generate_item_id():
    return f"SI-{uuid.uuid4().hex[:8].upper()}"

MONTHS_ES = {
    1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
    5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
    9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

# ============================================================================
# NOTIFICACIONES — generación automática
# ============================================================================

def check_and_generate_notifications(org_id: int):
    """Revisa condiciones del negocio y crea notificaciones si aplica.
    Evita duplicados: no crea si ya existe una sin leer del mismo tipo."""
    try:
        # 1. Stock bajo / agotado
        prods = supabase.table('products') \
            .select('name, stock_current, stock_min') \
            .eq('org_id', org_id).eq('active', True).execute()

        low = [p for p in prods.data if p['stock_current'] <= p['stock_min']]
        if low:
            existing = supabase.table('notifications').select('id') \
                .eq('org_id', org_id).eq('type', 'stock_bajo').eq('read', False).execute()
            if not existing.data:
                names = ", ".join(p['name'] for p in low[:4])
                extra = f" y {len(low) - 4} más" if len(low) > 4 else ""
                supabase.table('notifications').insert({
                    'org_id': org_id,
                    'type': 'stock_bajo',
                    'title': f"{len(low)} producto{'s' if len(low) > 1 else ''} con stock bajo",
                    'message': f"Revisa: {names}{extra}."
                }).execute()

        # 2. Días sin registrar ventas
        last = supabase.table('sales').select('sale_date') \
            .eq('org_id', org_id).order('sale_date', desc=True).limit(1).execute()
        if last.data:
            last_date = datetime.strptime(last.data[0]['sale_date'], '%Y-%m-%d').date()
            days = (date.today() - last_date).days
            if days >= 3:
                existing = supabase.table('notifications').select('id') \
                    .eq('org_id', org_id).eq('type', 'sin_ventas').eq('read', False).execute()
                if not existing.data:
                    supabase.table('notifications').insert({
                        'org_id': org_id,
                        'type': 'sin_ventas',
                        'title': f"Llevas {days} días sin registrar ventas",
                        'message': "Registra tus ventas para mantener tus métricas al día."
                    }).execute()
    except Exception as e:
        print(f"Error generando notificaciones: {e}", file=sys.stderr, flush=True)

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

        response = supabase.table('users').select('*').eq('username', username).execute()

        if not response.data:
            return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

        user = response.data[0]

        if not user.get('active', True):
            return jsonify({'error': 'Usuario desactivado. Contacta al dueño de tu organización.'}), 401

        if not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Usuario o contraseña incorrecta'}), 401

        org_id = user.get('org_id')
        token = create_token(user['id'], user['username'], user['role'], org_id)

        # Actualizar último acceso
        supabase.table('users').update({'last_login': datetime.utcnow().isoformat()}).eq('id', user['id']).execute()

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

        users_response = supabase.table('users').select('id, username, role, full_name, active').eq('org_id', org_id).execute()
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

        items_res = supabase.table('sale_items') \
            .select('product_id, quantity, subtotal') \
            .in_('sale_id', sale_ids) \
            .execute()

        product_totals = {}
        for item in items_res.data:
            pid = item['product_id']
            if pid not in product_totals:
                product_totals[pid] = {'subtotal': 0, 'quantity': 0}
            product_totals[pid]['subtotal'] += item['subtotal']
            product_totals[pid]['quantity'] += item['quantity']

        if not product_totals:
            return jsonify([]), 200

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
# ENDPOINT: VENTAS — ITEMS DE UNA VENTA
# ============================================================================

@app.route('/api/ventas/<sale_id>/items', methods=['GET'])
def get_venta_items(sale_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        res = supabase.table('sale_items') \
            .select('quantity, unit_price, subtotal, product_id') \
            .eq('sale_id', sale_id) \
            .execute()

        items = res.data
        product_ids = [i['product_id'] for i in items]

        prods_res = supabase.table('products') \
            .select('id, name') \
            .in_('id', product_ids) \
            .execute()

        name_map = {p['id']: p['name'] for p in prods_res.data}

        for item in items:
            item['product_name'] = name_map.get(item['product_id'], 'Producto')

        return jsonify({'items': items}), 200

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

        supabase.table('sales').insert({
            'id': sale_id,
            'org_id': org_id,
            'sale_date': today,
            'total_amount': round(total, 2),
            'payment_method': payment_method,
            'status': 'completada',
            'created_by': payload['user_id'],
        }).execute()

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

            prod_res = supabase.table('products').select('stock_current').eq('id', item['product_id']).execute()
            if prod_res.data:
                new_stock = max(0, prod_res.data[0]['stock_current'] - item['quantity'])
                supabase.table('products').update({'stock_current': new_stock}).eq('id', item['product_id']).execute()

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
# ENDPOINT: PRODUCTOS — EDITAR
# ============================================================================

@app.route('/api/productos/<int:product_id>', methods=['PATCH'])
def editar_producto(product_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        updates = {}
        if 'name' in data: updates['name'] = data['name']
        if 'sku' in data: updates['sku'] = data['sku']
        if 'unit_cost' in data: updates['unit_cost'] = data['unit_cost']
        if 'unit_price' in data: updates['unit_price'] = data['unit_price']
        if 'stock_min' in data: updates['stock_min'] = data['stock_min']

        if not updates:
            return jsonify({'error': 'Nada que actualizar'}), 400

        res = supabase.table('products').update(updates).eq('id', product_id).execute()
        return jsonify({'producto': res.data[0]}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: PRODUCTOS — SUBIR IMAGEN
# ============================================================================

@app.route('/api/productos/<int:product_id>/imagen', methods=['POST'])
def subir_imagen(product_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        image_data = data.get('image_data')
        content_type = data.get('content_type', 'image/jpeg')

        if not image_data:
            return jsonify({'error': 'No se recibió imagen'}), 400

        image_bytes = base64.b64decode(image_data)

        if len(image_bytes) > 2 * 1024 * 1024:
            return jsonify({'error': 'La imagen no puede superar 2MB'}), 400

        ext = 'jpg' if 'jpeg' in content_type else content_type.split('/')[-1]
        filename = f"org-{payload['org_id']}/product-{product_id}.{ext}"

        supabase.storage.from_('product-images').upload(
            filename,
            image_bytes,
            {'content-type': content_type, 'upsert': 'true'}
        )

        public_url = supabase.storage.from_('product-images').get_public_url(filename)

        supabase.table('products').update({'image_url': public_url}).eq('id', product_id).execute()

        return jsonify({'image_url': public_url}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINT: PRODUCTOS — VENTAS POR MES
# ============================================================================

@app.route('/api/productos/<int:product_id>/ventas', methods=['GET'])
def producto_ventas(product_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        items_res = supabase.table('sale_items') \
            .select('quantity, subtotal, sale_id') \
            .eq('product_id', product_id) \
            .execute()

        if not items_res.data:
            return jsonify({'ventas_por_mes': []}), 200

        sale_ids = [i['sale_id'] for i in items_res.data]

        sales_res = supabase.table('sales') \
            .select('id, sale_date') \
            .eq('org_id', org_id) \
            .eq('status', 'completada') \
            .in_('id', sale_ids) \
            .execute()

        date_map = {s['id']: s['sale_date'] for s in sales_res.data}

        by_month = {}
        for item in items_res.data:
            sale_date = date_map.get(item['sale_id'])
            if not sale_date:
                continue
            m = int(sale_date.split('-')[1])
            if m not in by_month:
                by_month[m] = {'total': 0, 'unidades': 0}
            by_month[m]['total'] += item['subtotal']
            by_month[m]['unidades'] += item['quantity']

        result = [
            {
                'mes': MONTHS_ES.get(m, str(m)),
                'total': round(vals['total'], 2),
                'unidades': int(vals['unidades']),
            }
            for m, vals in sorted(by_month.items())
        ]

        return jsonify({'ventas_por_mes': result}), 200

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

        prod_res = supabase.table('products').select('stock_current').eq('id', product_id).execute()
        if not prod_res.data:
            return jsonify({'error': 'Producto no encontrado'}), 404

        new_stock = prod_res.data[0]['stock_current'] + quantity

        supabase.table('products').update({'stock_current': new_stock}).eq('id', product_id).execute()

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
# ENDPOINT: INVENTARIO — MOVIMIENTOS
# ============================================================================

@app.route('/api/inventario/movimientos', methods=['GET'])
def get_movimientos():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        product_id = int(request.args.get('product_id'))
        org_id = int(request.args.get('org_id'))

        res = supabase.table('inventory_movements') \
            .select('id, type, quantity, reason, sale_id, created_at') \
            .eq('product_id', product_id) \
            .eq('org_id', org_id) \
            .order('created_at', desc=True) \
            .limit(20) \
            .execute()

        return jsonify({'movimientos': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — NOTIFICACIONES
# ============================================================================

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        # Genera notificaciones nuevas si aplica
        check_and_generate_notifications(org_id)

        res = supabase.table('notifications') \
            .select('*') \
            .eq('org_id', org_id) \
            .order('created_at', desc=True) \
            .limit(30) \
            .execute()

        unread = len([n for n in res.data if not n['read']])

        return jsonify({'notifications': res.data, 'unread_count': unread}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        supabase.table('notifications').update({'read': True}).eq('id', notif_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/read-all', methods=['POST'])
def mark_all_notifications_read():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = request.json.get('org_id')
        supabase.table('notifications').update({'read': True}).eq('org_id', org_id).eq('read', False).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/<int:notif_id>', methods=['DELETE'])
def delete_notification(notif_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        supabase.table('notifications').delete().eq('id', notif_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — CLIENTES (CRM)
# ============================================================================

@app.route('/api/clientes', methods=['GET'])
def get_clientes():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        org_id = int(request.args.get('org_id'))

        res = supabase.table('customers') \
            .select('*') \
            .eq('org_id', org_id) \
            .order('full_name') \
            .execute()

        return jsonify({'clientes': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/clientes/crear', methods=['POST'])
def crear_cliente():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        if not data.get('full_name'):
            return jsonify({'error': 'El nombre es obligatorio'}), 400

        res = supabase.table('customers').insert({
            'org_id': data['org_id'],
            'full_name': data['full_name'],
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'instagram': data.get('instagram', ''),
            'notes': data.get('notes', ''),
        }).execute()

        return jsonify({'cliente': res.data[0]}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/clientes/<int:cliente_id>', methods=['PATCH'])
def editar_cliente(cliente_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        updates = {}
        for field in ['full_name', 'email', 'phone', 'instagram', 'notes']:
            if field in data:
                updates[field] = data[field]

        if not updates:
            return jsonify({'error': 'Nada que actualizar'}), 400

        res = supabase.table('customers').update(updates).eq('id', cliente_id).execute()
        return jsonify({'cliente': res.data[0]}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/clientes/<int:cliente_id>', methods=['DELETE'])
def eliminar_cliente(cliente_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        supabase.table('customers').delete().eq('id', cliente_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — PEDIDOS / ENVÍOS
# ============================================================================

@app.route('/api/pedidos', methods=['GET'])
def get_pedidos():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        res = supabase.table('orders') \
            .select('*') \
            .eq('org_id', org_id) \
            .order('created_at', desc=True) \
            .execute()

        return jsonify({'pedidos': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/pedidos/crear', methods=['POST'])
def crear_pedido():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        if not data.get('customer_name'):
            return jsonify({'error': 'El nombre del cliente es obligatorio'}), 400

        res = supabase.table('orders').insert({
            'org_id': data['org_id'],
            'sale_id': data.get('sale_id'),
            'customer_name': data['customer_name'],
            'carrier': data.get('carrier', ''),
            'tracking_number': data.get('tracking_number', ''),
            'status': data.get('status', 'preparando'),
            'shipping_cost': data.get('shipping_cost', 0),
            'address': data.get('address', ''),
            'notes': data.get('notes', ''),
            'created_by': payload['user_id'],
        }).execute()

        return jsonify({'pedido': res.data[0]}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/pedidos/<int:pedido_id>', methods=['PATCH'])
def editar_pedido(pedido_id):
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        updates = {}
        for field in ['customer_name', 'carrier', 'tracking_number', 'status', 'shipping_cost', 'address', 'notes']:
            if field in data:
                updates[field] = data[field]

        # Fechas automáticas según el estado
        if data.get('status') == 'enviado':
            updates['shipped_at'] = date.today().isoformat()
        if data.get('status') == 'entregado':
            updates['delivered_at'] = date.today().isoformat()

        if not updates:
            return jsonify({'error': 'Nada que actualizar'}), 400

        res = supabase.table('orders').update(updates).eq('id', pedido_id).execute()
        return jsonify({'pedido': res.data[0]}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — GASTOS (para Finanzas)
# ============================================================================

@app.route('/api/gastos', methods=['GET'])
def get_gastos():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')

        query = supabase.table('expenses') \
            .select('*') \
            .eq('org_id', org_id) \
            .order('expense_date', desc=True)

        if start:
            query = query.gte('expense_date', start)
        if end:
            query = query.lte('expense_date', end)

        res = query.execute()
        return jsonify({'gastos': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/gastos/crear', methods=['POST'])
def crear_gasto():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        if not data.get('category') or not data.get('amount'):
            return jsonify({'error': 'Categoría y monto son obligatorios'}), 400

        res = supabase.table('expenses').insert({
            'org_id': data['org_id'],
            'category': data['category'],
            'description': data.get('description', ''),
            'amount': data['amount'],
            'expense_date': data.get('expense_date', date.today().isoformat()),
            'created_by': payload['user_id'],
        }).execute()

        return jsonify({'gasto': res.data[0]}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/gastos/<int:gasto_id>', methods=['DELETE'])
def eliminar_gasto(gasto_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        supabase.table('expenses').delete().eq('id', gasto_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — FINANZAS (resumen completo)
# ============================================================================

@app.route('/api/finanzas/resumen', methods=['GET'])
def finanzas_resumen():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        org_id = int(request.args.get('org_id'))
        start = request.args.get('start')
        end = request.args.get('end')

        # Ingresos por venta
        sales_res = supabase.table('sales') \
            .select('id, sale_date, total_amount') \
            .eq('org_id', org_id).eq('status', 'completada') \
            .gte('sale_date', start).lte('sale_date', end).execute()

        ingresos = sum(s['total_amount'] for s in sales_res.data)

        # Costo de mercancía vendida (aprox. con costo actual del producto)
        costo_mercancia = 0
        if sales_res.data:
            sale_ids = [s['id'] for s in sales_res.data]
            items_res = supabase.table('sale_items') \
                .select('product_id, quantity').in_('sale_id', sale_ids).execute()
            if items_res.data:
                pids = list(set(i['product_id'] for i in items_res.data))
                prods_res = supabase.table('products').select('id, unit_cost').in_('id', pids).execute()
                cost_map = {p['id']: (p['unit_cost'] or 0) for p in prods_res.data}
                costo_mercancia = sum(cost_map.get(i['product_id'], 0) * i['quantity'] for i in items_res.data)

        # Gastos operativos registrados
        exp_res = supabase.table('expenses') \
            .select('category, amount, expense_date') \
            .eq('org_id', org_id) \
            .gte('expense_date', start).lte('expense_date', end).execute()

        gastos_operativos = sum(e['amount'] for e in exp_res.data)

        # Gastos por categoría
        por_categoria = {}
        for e in exp_res.data:
            por_categoria[e['category']] = por_categoria.get(e['category'], 0) + e['amount']

        utilidad = ingresos - costo_mercancia - gastos_operativos
        margen = (utilidad / ingresos * 100) if ingresos > 0 else 0

        # Ingresos vs gastos por mes
        por_mes = {}
        for s in sales_res.data:
            m = int(s['sale_date'].split('-')[1])
            if m not in por_mes:
                por_mes[m] = {'ingresos': 0, 'gastos': 0}
            por_mes[m]['ingresos'] += s['total_amount']
        for e in exp_res.data:
            m = int(e['expense_date'].split('-')[1])
            if m not in por_mes:
                por_mes[m] = {'ingresos': 0, 'gastos': 0}
            por_mes[m]['gastos'] += e['amount']

        chart = [
            {'mes': MONTHS_ES.get(m, str(m)), 'ingresos': round(v['ingresos'], 2), 'gastos': round(v['gastos'], 2)}
            for m, v in sorted(por_mes.items())
        ]

        # Flujo de caja: promedio diario neto últimos 60 días → proyección 30 días
        d60 = (date.today() - timedelta(days=60)).isoformat()
        s60 = supabase.table('sales').select('total_amount') \
            .eq('org_id', org_id).eq('status', 'completada').gte('sale_date', d60).execute()
        e60 = supabase.table('expenses').select('amount') \
            .eq('org_id', org_id).gte('expense_date', d60).execute()
        neto_60 = sum(s['total_amount'] for s in s60.data) - sum(e['amount'] for e in e60.data)
        proyeccion_30 = round((neto_60 / 60) * 30, 2)

        # Tips basados en reglas
        tips = []
        if not exp_res.data:
            tips.append('Registra tus gastos (renta, servicios, mercancía) para conocer tu utilidad real.')
        if margen < 20 and ingresos > 0 and exp_res.data:
            tips.append(f'Tu margen neto es de {round(margen, 1)}%. Un negocio de retail saludable suele estar arriba del 20%. Revisa costos de mercancía o precios de venta.')
        if por_categoria.get('Marketing', 0) == 0 and ingresos > 0:
            tips.append('No registras inversión en marketing este periodo. Invertir 5-10% de tus ingresos en campañas suele acelerar el crecimiento.')
        if ingresos > 0 and gastos_operativos / ingresos > 0.4:
            tips.append('Tus gastos operativos superan el 40% de tus ingresos. Identifica qué categoría pesa más y busca reducirla.')
        if proyeccion_30 < 0:
            tips.append('Tu proyección de flujo a 30 días es negativa. Prioriza cobrar pendientes y pospón gastos no esenciales.')
        if not tips:
            tips.append('Tus finanzas se ven sanas este periodo. Mantén el registro constante de gastos para no perder visibilidad.')

        return jsonify({
            'ingresos': round(ingresos, 2),
            'costo_mercancia': round(costo_mercancia, 2),
            'gastos_operativos': round(gastos_operativos, 2),
            'utilidad': round(utilidad, 2),
            'margen': round(margen, 1),
            'por_categoria': [{'categoria': k, 'monto': round(v, 2)} for k, v in sorted(por_categoria.items(), key=lambda x: -x[1])],
            'chart': chart,
            'proyeccion_30': proyeccion_30,
            'tips': tips,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — CAMPAÑAS DE MARKETING
# ============================================================================

@app.route('/api/campanas', methods=['GET'])
def get_campanas():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        org_id = int(request.args.get('org_id'))

        res = supabase.table('campaigns') \
            .select('*') \
            .eq('org_id', org_id) \
            .order('created_at', desc=True) \
            .execute()

        return jsonify({'campanas': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/campanas/crear', methods=['POST'])
def crear_campana():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        if not data.get('name'):
            return jsonify({'error': 'El nombre de la campaña es obligatorio'}), 400

        res = supabase.table('campaigns').insert({
            'org_id': data['org_id'],
            'name': data['name'],
            'platform': data.get('platform', 'instagram'),
            'status': data.get('status', 'activa'),
            'budget': data.get('budget', 0),
            'spent': data.get('spent', 0),
            'reach': data.get('reach', 0),
            'impressions': data.get('impressions', 0),
            'clicks': data.get('clicks', 0),
            'conversions': data.get('conversions', 0),
            'start_date': data.get('start_date'),
            'end_date': data.get('end_date'),
            'notes': data.get('notes', ''),
        }).execute()

        return jsonify({'campana': res.data[0]}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/campanas/<int:campana_id>', methods=['PATCH'])
def editar_campana(campana_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        updates = {}
        for field in ['name', 'platform', 'status', 'budget', 'spent', 'reach',
                      'impressions', 'clicks', 'conversions', 'start_date', 'end_date', 'notes']:
            if field in data:
                updates[field] = data[field]

        if not updates:
            return jsonify({'error': 'Nada que actualizar'}), 400

        res = supabase.table('campaigns').update(updates).eq('id', campana_id).execute()
        return jsonify({'campana': res.data[0]}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/campanas/<int:campana_id>', methods=['DELETE'])
def eliminar_campana(campana_id):
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        supabase.table('campaigns').delete().eq('id', campana_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — MARKETPLACE DE HERRAMIENTAS
# ============================================================================

@app.route('/api/tools', methods=['GET'])
def get_tools():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        res = supabase.table('tools').select('*').eq('active', True).order('id').execute()
        return jsonify({'tools': res.data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _limpiar_org_tools_vencidas(org_id: int):
    """Borra herramientas cuya baja (cancel_at) ya se cumplió.
    Se llama antes de leer org_tools para que el acceso se corte
    exactamente cuando termina el ciclo de 30 días pagado."""
    today = date.today().isoformat()
    vencidas = supabase.table('org_tools').select('id, cancel_at') \
        .eq('org_id', org_id).not_.is_('cancel_at', 'null').execute()
    for row in vencidas.data:
        if row['cancel_at'] and row['cancel_at'] <= today:
            supabase.table('org_tools').delete().eq('id', row['id']).execute()


@app.route('/api/org-tools', methods=['GET'])
def get_org_tools():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        _limpiar_org_tools_vencidas(org_id)

        ot_res = supabase.table('org_tools').select('tool_id, included_in_plan').eq('org_id', org_id).execute()
        if not ot_res.data:
            return jsonify({'active_keys': [], 'detail': []}), 200

        tool_ids = [t['tool_id'] for t in ot_res.data]
        tools_res = supabase.table('tools').select('id, key').in_('id', tool_ids).execute()
        key_map = {t['id']: t['key'] for t in tools_res.data}

        detail = [
            {'key': key_map.get(t['tool_id']), 'included_in_plan': t['included_in_plan']}
            for t in ot_res.data if key_map.get(t['tool_id'])
        ]

        return jsonify({
            'active_keys': [d['key'] for d in detail],
            'detail': detail
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/org-tools/gestion', methods=['GET'])
def gestion_org_tools():
    """Vista completa para Mi Perfil y el marketplace: todas las herramientas
    con su estado (incluida / activa / pendiente de baja / disponible),
    fechas relevantes, y el total mensual calculado en vivo."""
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        org_id = int(request.args.get('org_id'))
        _limpiar_org_tools_vencidas(org_id)

        all_tools = supabase.table('tools').select('*').eq('active', True).order('id').execute().data
        org_tools = supabase.table('org_tools').select('*').eq('org_id', org_id).execute().data
        by_tool_id = {ot['tool_id']: ot for ot in org_tools}

        today = date.today().isoformat()

        result = []
        total_addons = 0

        for t in all_tools:
            ot = by_tool_id.get(t['id'])
            if not ot:
                status = 'disponible'
                activated_at = None
                cancel_at = None
            elif ot['included_in_plan']:
                status = 'incluida'
                activated_at = ot.get('activated_at')
                cancel_at = None
            elif ot.get('cancel_at'):
                status = 'pendiente_baja'
                activated_at = ot.get('activated_at')
                cancel_at = ot['cancel_at']
                total_addons += t['monthly_price']
            else:
                status = 'activa'
                activated_at = ot.get('activated_at')
                cancel_at = None
                total_addons += t['monthly_price']

            result.append({
                'key': t['key'],
                'name': t['name'],
                'description': t['description'],
                'monthly_price': t['monthly_price'],
                'status': status,
                'activated_at': activated_at,
                'cancel_at': cancel_at,
            })

        # Plan base de la org
        sub_res = supabase.table('subscriptions').select('plan_id').eq('org_id', org_id).execute()
        base_price = 0
        addon_count = sum(1 for r in result if r['status'] in ('activa', 'pendiente_baja'))
        if sub_res.data:
            plan_res = supabase.table('plans').select('base_price').eq('id', sub_res.data[0]['plan_id']).execute()
            if plan_res.data:
                base_price = plan_res.data[0]['base_price']

        return jsonify({
            'tools': result,
            'base_price': base_price,
            'addon_count': addon_count,
            'total_monthly': round(base_price + total_addons, 2),
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/org-tools/activar', methods=['POST'])
def activar_tool():
    """Activa una herramienta nueva, o si estaba dada de baja pendiente
    (cancel_at seteado), revierte la baja y la deja activa de nuevo."""
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        org_id = data.get('org_id')
        tool_key = data.get('tool_key')

        tool_res = supabase.table('tools').select('id, monthly_price').eq('key', tool_key).execute()
        if not tool_res.data:
            return jsonify({'error': 'Herramienta no encontrada'}), 404

        tool = tool_res.data[0]

        existing = supabase.table('org_tools').select('id, included_in_plan, cancel_at') \
            .eq('org_id', org_id).eq('tool_id', tool['id']).execute()

        if existing.data:
            row = existing.data[0]
            if row['included_in_plan']:
                return jsonify({'error': 'Esta herramienta ya está incluida en tu plan'}), 400
            if row.get('cancel_at'):
                # Estaba pendiente de baja — la reactivamos
                supabase.table('org_tools').update({'cancel_at': None}).eq('id', row['id']).execute()
                return jsonify({'status': 'reactivada'}), 200
            return jsonify({'error': 'Esta herramienta ya está activa'}), 400

        supabase.table('org_tools').insert({
            'org_id': org_id,
            'tool_id': tool['id'],
            'included_in_plan': False,
            'activated_at': date.today().isoformat(),
            'cancel_at': None,
        }).execute()

        return jsonify({'status': 'activada', 'monthly_price': tool['monthly_price']}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/org-tools/desactivar', methods=['POST'])
def desactivar_tool():
    """Marca una herramienta para darse de baja. No se quita al instante:
    el dueño se comprometió a 30 días desde que la activó, así que conserva
    acceso hasta que termine el ciclo actual (cancel_at)."""
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        data = request.json
        org_id = data.get('org_id')
        tool_key = data.get('tool_key')

        tool_res = supabase.table('tools').select('id').eq('key', tool_key).execute()
        if not tool_res.data:
            return jsonify({'error': 'Herramienta no encontrada'}), 404
        tool_id = tool_res.data[0]['id']

        row_res = supabase.table('org_tools').select('id, included_in_plan, activated_at, cancel_at') \
            .eq('org_id', org_id).eq('tool_id', tool_id).execute()
        if not row_res.data:
            return jsonify({'error': 'No tienes esta herramienta activa'}), 404

        row = row_res.data[0]
        if row['included_in_plan']:
            return jsonify({'error': 'Esta herramienta es parte de tu plan base y no se puede quitar'}), 400
        if row.get('cancel_at'):
            return jsonify({'status': 'ya_pendiente', 'cancel_at': row['cancel_at']}), 200

        activated_at = datetime.strptime(row['activated_at'], '%Y-%m-%d').date() if row.get('activated_at') else date.today()
        dias_activa = (date.today() - activated_at).days
        ciclos_completos = dias_activa // 30
        cancel_at = activated_at + timedelta(days=(ciclos_completos + 1) * 30)

        supabase.table('org_tools').update({'cancel_at': cancel_at.isoformat()}).eq('id', row['id']).execute()

        return jsonify({'status': 'baja_programada', 'cancel_at': cancel_at.isoformat()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — MI PERFIL
# ============================================================================

@app.route('/api/perfil', methods=['GET'])
def get_perfil():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'employee', 'admin']:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))

        org_res = supabase.table('organizations').select('*').eq('id', org_id).execute()
        org = org_res.data[0] if org_res.data else None
        if not org:
            return jsonify({'error': 'Organización no encontrada'}), 404

        # Suscripción y plan
        sub_res = supabase.table('subscriptions').select('*').eq('org_id', org_id).execute()
        sub = sub_res.data[0] if sub_res.data else None
        plan = None
        if sub:
            plan_res = supabase.table('plans').select('*').eq('id', sub['plan_id']).execute()
            plan = plan_res.data[0] if plan_res.data else None

        # Usuarios de la org
        users_res = supabase.table('users') \
            .select('id, username, role, full_name, active, last_login, created_at') \
            .eq('org_id', org_id).execute()

        # Stats para el banner
        all_sales = supabase.table('sales').select('sale_date, total_amount') \
            .eq('org_id', org_id).eq('status', 'completada').execute()

        total_ventas = len(all_sales.data)
        total_ingresos = sum(s['total_amount'] for s in all_sales.data)

        # Crecimiento: este mes vs mes anterior
        today = date.today()
        first_this = today.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        first_last = last_month_end.replace(day=1)

        this_month = sum(s['total_amount'] for s in all_sales.data
                         if s['sale_date'] >= first_this.isoformat())
        last_month = sum(s['total_amount'] for s in all_sales.data
                         if first_last.isoformat() <= s['sale_date'] <= last_month_end.isoformat())

        growth_pct = round(((this_month - last_month) / last_month * 100), 1) if last_month > 0 else None

        return jsonify({
            'org': {
                'id': org['id'],
                'name': org['name'],
                'industry': org.get('industry'),
                'created_at': org.get('created_at'),
            },
            'plan': {
                'name': plan['name'] if plan else 'Sin plan',
                'base_price': plan['base_price'] if plan else 0,
                'included_tools': plan['included_tools'] if plan else 0,
                'max_users': plan['max_users'] if plan else None,
            },
            'subscription': {
                'status': sub['status'] if sub else None,
                'total_monthly': sub['total_monthly'] if sub else 0,
                'next_billing': sub['next_billing'] if sub else None,
            },
            'users': users_res.data,
            'stats': {
                'total_ventas': total_ventas,
                'total_ingresos': round(total_ingresos, 2),
                'ventas_este_mes': round(this_month, 2),
                'growth_pct': growth_pct,
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/perfil/change-password', methods=['POST'])
def change_own_password():
    try:
        payload = get_token_payload()
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        data = request.json
        current = data.get('current_password')
        new = data.get('new_password')

        if not current or not new:
            return jsonify({'error': 'Ambas contraseñas son obligatorias'}), 400
        if len(new) < 6:
            return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres'}), 400

        user_res = supabase.table('users').select('password_hash').eq('id', payload['user_id']).execute()
        if not user_res.data:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        if not verify_password(current, user_res.data[0]['password_hash']):
            return jsonify({'error': 'La contraseña actual es incorrecta'}), 401

        supabase.table('users').update({
            'password_hash': hash_password(new)
        }).eq('id', payload['user_id']).execute()

        return jsonify({'status': 'Contraseña actualizada'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/org-users/<int:user_id>', methods=['PATCH'])
def editar_usuario_org(user_id):
    """El owner puede editar empleados de SU organización:
    nombre, activo/inactivo y resetear contraseña."""
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'admin']:
            return jsonify({'error': 'No tienes permisos'}), 403

        # Verificar que el usuario pertenece a la misma org (si no es admin)
        target_res = supabase.table('users').select('org_id, role').eq('id', user_id).execute()
        if not target_res.data:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        target = target_res.data[0]
        if payload['role'] == 'owner' and target['org_id'] != payload['org_id']:
            return jsonify({'error': 'No puedes editar usuarios de otra organización'}), 403

        data = request.json
        updates = {}
        if 'full_name' in data:
            updates['full_name'] = data['full_name']
        if 'active' in data:
            updates['active'] = data['active']
        if data.get('new_password'):
            if len(data['new_password']) < 6:
                return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
            updates['password_hash'] = hash_password(data['new_password'])

        if not updates:
            return jsonify({'error': 'Nada que actualizar'}), 400

        supabase.table('users').update(updates).eq('id', user_id).execute()
        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# NUEVO — VISTA DE EMPLEADO
# ============================================================================

@app.route('/api/employee/resumen', methods=['GET'])
def employee_resumen():
    try:
        payload = get_token_payload()
        if not payload or payload['role'] not in ['owner', 'employee']:
            return jsonify({'error': 'Token inválido'}), 401

        org_id = int(request.args.get('org_id'))
        today = date.today().isoformat()

        # Ventas de hoy
        sales_res = supabase.table('sales') \
            .select('total_amount') \
            .eq('org_id', org_id).eq('status', 'completada') \
            .eq('sale_date', today).execute()

        ventas_hoy = len(sales_res.data)
        total_hoy = sum(s['total_amount'] for s in sales_res.data)

        # Alertas de stock
        prods_res = supabase.table('products') \
            .select('name, stock_current, stock_min') \
            .eq('org_id', org_id).eq('active', True).execute()

        alertas = [
            {'name': p['name'], 'stock': p['stock_current'], 'agotado': p['stock_current'] == 0}
            for p in prods_res.data if p['stock_current'] <= p['stock_min']
        ]

        return jsonify({
            'ventas_hoy': ventas_hoy,
            'total_hoy': round(total_hoy, 2),
            'alertas_stock': alertas,
            'total_productos': len(prods_res.data),
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENDPOINTS EXISTENTES — administración
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
        supabase.table('users').update({
            'password_hash': password_hash
        }).eq('id', data.get('user_id')).execute()
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

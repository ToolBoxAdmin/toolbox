import os
from dotenv import load_dotenv

# Cargar variables de .env (archivo que NO sube a GitHub)
load_dotenv()

class Config:
    """Configuración principal de la app"""
    
    # SUPABASE (Base de Datos en la nube)
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    
    # JWT (para crear tokens de login)
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    
    # FLASK
    DEBUG = os.getenv('DEBUG', 'False') == 'True'
    
    # CORS (permite que Vercel (frontend) hable con Render (backend))
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,https://toolbox.mx')

# Validar que Supabase esté configurado
if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
    raise ValueError("❌ SUPABASE_URL y SUPABASE_KEY no están configurados en .env")

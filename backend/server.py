from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import StreamingResponse, FileResponse
import os
import logging
import asyncio
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Image as RLImage
from pypdf import PdfWriter, PdfReader

# Create uploads directory
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'elearning360-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Resend Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Create the main app
app = FastAPI(title="eLearning 360 Project Manager")

# Configure CORS
origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= MODELS =============

# ============= DEFAULT CONFIGURATIONS =============

DEFAULT_USER_TYPES = [
    {"id": "comercial", "name": "Comercial", "color": "emerald"},
    {"id": "marketing", "name": "Marketing", "color": "purple"},
    {"id": "administracion", "name": "Administración", "color": "slate"},
    {"id": "creativo", "name": "Creativo", "color": "pink"},
    {"id": "contenido", "name": "Contenido", "color": "amber"},
    {"id": "academico", "name": "Académico", "color": "cyan"},
    {"id": "desarrollo", "name": "Desarrollo", "color": "blue"},
    {"id": "direccion", "name": "Dirección", "color": "red"},
]

DEFAULT_ROLES = [
    {"id": "admin", "name": "Administrador", "description": "Control total del sistema", "permissions": ["all"]},
    {"id": "project_manager", "name": "Project Manager", "description": "Gestión de proyectos y tareas", "permissions": ["projects", "tasks", "deliverables"]},
    {"id": "collaborator", "name": "Colaborador", "description": "Visualización y actualización de tareas asignadas", "permissions": ["view", "update_tasks"]},
]

DEFAULT_MODULE_COSTS = {
    "design": 1000.0,
    "tech": 2000.0,
    "marketing": 1500.0,
    "sales": 1200.0,
    "content": 800.0,
    "admin": 500.0,
    "academic": 1000.0,
}

# ============= CONFIGURATION MODELS =============

class UserTypeConfig(BaseModel):
    id: str
    name: str
    color: str = "slate"

class RoleConfig(BaseModel):
    id: str
    name: str
    description: str = ""
    permissions: List[str] = []

class TaskTemplate(BaseModel):
    title: str
    description: str = ""
    assigned_user_type: Optional[str] = None
    checklist: List[dict] = []
    deliverables: List[dict] = []

class ModuleConfig(BaseModel):
    id: str
    name: str
    description: str = ""
    icon: str = "Package"
    color: str = "slate"
    tasks: List[dict] = []

class ModuleCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = "Package"
    color: str = "slate"

class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class TaskTemplateCreate(BaseModel):
    title: str
    description: str = ""
    assigned_user_type: Optional[str] = None
    checklist: List[dict] = []
    deliverables: List[dict] = []

class TaskTemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_user_type: Optional[str] = None
    checklist: Optional[List[dict]] = None
    deliverables: Optional[List[dict]] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "collaborator"  # admin, project_manager, collaborator
    user_type: Optional[str] = None  # comercial, marketing, etc.

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    user_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    user_type: Optional[str] = None

class ModuleConfig(BaseModel):
    id: str
    name: str
    enabled: bool = True

class ProjectCreate(BaseModel):
    name: str
    client_name: str
    start_date: str
    end_date: str
    modules: List[str]  # List of module IDs
    description: Optional[str] = ""
    module_costs: Optional[dict] = None
    billing_mode: str = "module" # module, project
    cost_per_module: float = 0.0
    total_project_cost: float = 0.0
    enrollment_payment: float = 0.0

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    modules: Optional[List[str]] = None
    module_costs: Optional[dict] = None
    billing_mode: Optional[str] = None
    cost_per_module: Optional[float] = None
    total_project_cost: Optional[float] = None
    enrollment_payment: Optional[float] = None

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    client_name: str
    start_date: str
    end_date: str
    modules: List[str]
    module_costs: dict = {}
    billing_mode: str = "module"
    status: str = "active"  # active, completed, on_hold, cancelled
    description: str = ""
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    progress: float = 0.0
    cost_per_module: float = 0.0
    total_project_cost: float = 0.0
    enrollment_payment: float = 0.0

class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    completed: bool = False

class Deliverable(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    status: str = "pending"  # pending, in_review, approved, rejected
    due_date: Optional[str] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    uploaded_at: Optional[str] = None
    uploaded_by: Optional[str] = None
    feedback: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None

class DeliverableCreate(BaseModel):
    task_id: str
    name: str
    description: Optional[str] = ""
    due_date: Optional[str] = None

class DeliverableUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    feedback: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    module_id: str
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_user_type: Optional[str] = None  # comercial, marketing, etc.
    checklist: List[dict] = []
    deliverables: List[dict] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_user_type: Optional[str] = None
    checklist: Optional[List[dict]] = None
    deliverables: Optional[List[dict]] = None

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    module_id: str
    title: str
    description: str = ""
    status: str = "pending"  # pending, in_progress, completed
    checklist: List[dict] = []
    deliverables: List[dict] = []
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_user_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # task_assigned, deadline_reminder, project_update
    title: str
    message: str
    read: bool = False
    project_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= MODULE TEMPLATES =============

MODULE_TEMPLATES = {
    "design": {
        "id": "design",
        "name": "Diseño de Marca e Identidad Visual",
        "tasks": [
            {
                "title": "Propuestas de Logotipo",
                "description": "Diseño y presentación de opciones de logotipo para el proyecto",
                "assigned_user_type": "creativo",
                "checklist": [
                    {"text": "Investigación de marca", "completed": False},
                    {"text": "Bocetos iniciales", "completed": False},
                    {"text": "Propuesta 1 - Versión principal", "completed": False},
                    {"text": "Propuesta 2 - Versión alternativa", "completed": False},
                    {"text": "Revisión con cliente", "completed": False},
                    {"text": "Versión final aprobada", "completed": False}
                ],
                "deliverables": [
                    {"name": "Documento de propuestas de logo (PDF)"},
                    {"name": "Archivos vectoriales del logo final"}
                ]
            },
            {
                "title": "Identidad Visual Completa",
                "description": "Desarrollo de la identidad visual: colores, tipografías, formatos",
                "assigned_user_type": "creativo",
                "checklist": [
                    {"text": "Definición de paleta de colores", "completed": False},
                    {"text": "Selección de tipografías", "completed": False},
                    {"text": "Diseño de formatos de difusión", "completed": False},
                    {"text": "Manual de identidad visual", "completed": False}
                ],
                "deliverables": [
                    {"name": "Manual de Identidad Visual (PDF)"},
                    {"name": "Kit de recursos gráficos"}
                ]
            },
            {
                "title": "Señalética de Edificios",
                "description": "Diseño de señalización para espacios físicos",
                "assigned_user_type": "creativo",
                "checklist": [
                    {"text": "Diseño de señalética de accesos", "completed": False},
                    {"text": "Señalética de espacios formativos", "completed": False},
                    {"text": "Señalética de espacios comunes", "completed": False},
                    {"text": "Aprobación de diseños", "completed": False}
                ],
                "deliverables": [
                    {"name": "Planos de señalética"},
                    {"name": "Archivos para producción"}
                ]
            }
        ]
    },
    "tech": {
        "id": "tech",
        "name": "Tecnología y Desarrollo",
        "tasks": [
            {
                "title": "Portal Web Principal",
                "description": "Desarrollo e implantación del portal web del proyecto",
                "assigned_user_type": "desarrollo",
                "checklist": [
                    {"text": "Definición de arquitectura", "completed": False},
                    {"text": "Diseño UX/UI", "completed": False},
                    {"text": "Desarrollo frontend", "completed": False},
                    {"text": "Desarrollo backend", "completed": False},
                    {"text": "Integración de sistemas", "completed": False},
                    {"text": "Testing y QA", "completed": False},
                    {"text": "Despliegue en producción", "completed": False}
                ],
                "deliverables": [
                    {"name": "Portal web operativo"},
                    {"name": "Documentación técnica"}
                ]
            },
            {
                "title": "Landing Pages y Páginas de Campaña",
                "description": "Creación de landing pages y squeeze pages para campañas",
                "assigned_user_type": "desarrollo",
                "checklist": [
                    {"text": "Diseño de landing pages", "completed": False},
                    {"text": "Desarrollo de squeeze pages", "completed": False},
                    {"text": "Configuración de formularios", "completed": False},
                    {"text": "Integración con CRM", "completed": False}
                ],
                "deliverables": [
                    {"name": "Landing pages operativas"},
                    {"name": "Informe de conversión"}
                ]
            },
            {
                "title": "Sistema de Gestión de Pagos",
                "description": "Integración de sistema de pagos y domiciliaciones",
                "assigned_user_type": "desarrollo",
                "checklist": [
                    {"text": "Selección de pasarela de pago", "completed": False},
                    {"text": "Integración con plataforma", "completed": False},
                    {"text": "Configuración de domiciliaciones", "completed": False},
                    {"text": "Testing de transacciones", "completed": False}
                ],
                "deliverables": [
                    {"name": "Sistema de pagos operativo"},
                    {"name": "Manual de uso"}
                ]
            },
            {
                "title": "Plataforma LMS",
                "description": "Personalización y parametrización de la plataforma LMS",
                "assigned_user_type": "desarrollo",
                "checklist": [
                    {"text": "Personalización visual", "completed": False},
                    {"text": "Parametrización de cursos", "completed": False},
                    {"text": "Integración con otros sistemas", "completed": False},
                    {"text": "Configuración de roles y permisos", "completed": False}
                ],
                "deliverables": [
                    {"name": "LMS configurado"},
                    {"name": "Guía de administración"}
                ]
            },
            {
                "title": "Sistemas de Streaming",
                "description": "Configuración de aulas de teleformación y streaming",
                "assigned_user_type": "desarrollo",
                "checklist": [
                    {"text": "Selección de plataforma de streaming", "completed": False},
                    {"text": "Configuración de aulas virtuales", "completed": False},
                    {"text": "Integración con LMS", "completed": False},
                    {"text": "Pruebas de calidad de transmisión", "completed": False}
                ],
                "deliverables": [
                    {"name": "Sistema de streaming operativo"},
                    {"name": "Manual de uso para docentes"}
                ]
            }
        ]
    },
    "marketing": {
        "id": "marketing",
        "name": "Comunicación y Marketing",
        "tasks": [
            {
                "title": "Diseño de Campañas de Marketing",
                "description": "Planificación y diseño de campañas de comunicación",
                "assigned_user_type": "marketing",
                "checklist": [
                    {"text": "Definición de objetivos", "completed": False},
                    {"text": "Campaña de Branding", "completed": False},
                    {"text": "Campaña de Visibilidad", "completed": False},
                    {"text": "Campaña de Alcance", "completed": False},
                    {"text": "Calendario de publicaciones", "completed": False}
                ],
                "deliverables": [
                    {"name": "Plan de Marketing (PDF)"},
                    {"name": "Calendario editorial"}
                ]
            },
            {
                "title": "Marketing de Contenidos",
                "description": "Estrategia de contenidos y posicionamiento orgánico",
                "assigned_user_type": "marketing",
                "checklist": [
                    {"text": "Estrategia de contenidos", "completed": False},
                    {"text": "Plan de mantenimiento de blog", "completed": False},
                    {"text": "Análisis de palabras clave", "completed": False},
                    {"text": "Segmentación de público objetivo", "completed": False},
                    {"text": "Gestión de presupuestos", "completed": False}
                ],
                "deliverables": [
                    {"name": "Estrategia SEO"},
                    {"name": "Informe de keywords"}
                ]
            },
            {
                "title": "Gestión de Paid Media",
                "description": "Administración de campañas de publicidad pagada",
                "assigned_user_type": "marketing",
                "checklist": [
                    {"text": "Configuración de cuentas publicitarias", "completed": False},
                    {"text": "Parametrización de campañas", "completed": False},
                    {"text": "Creación de audiencias", "completed": False},
                    {"text": "Optimización continua", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de rendimiento de campañas"},
                    {"name": "Dashboard de seguimiento"}
                ]
            },
            {
                "title": "Cuadros de Mando de Adquisición",
                "description": "Estructuración de dashboards y seguimiento",
                "assigned_user_type": "marketing",
                "checklist": [
                    {"text": "Definición de KPIs", "completed": False},
                    {"text": "Estructuración de cuadros de mando", "completed": False},
                    {"text": "Configuración de informes automáticos", "completed": False}
                ],
                "deliverables": [
                    {"name": "Dashboard de adquisición"},
                    {"name": "Informes mensuales"}
                ]
            }
        ]
    },
    "sales": {
        "id": "sales",
        "name": "Atención Comercial",
        "tasks": [
            {
                "title": "Argumentarios de Venta",
                "description": "Elaboración de argumentarios y highlights del programa",
                "assigned_user_type": "comercial",
                "checklist": [
                    {"text": "Identificación de highlights", "completed": False},
                    {"text": "Redacción de argumentarios", "completed": False},
                    {"text": "Validación con dirección", "completed": False},
                    {"text": "Distribución al equipo comercial", "completed": False}
                ],
                "deliverables": [
                    {"name": "Documento de argumentarios"},
                    {"name": "Fichas de producto"}
                ]
            },
            {
                "title": "Training Comercial",
                "description": "Formación y entrenamiento del equipo comercial",
                "assigned_user_type": "comercial",
                "checklist": [
                    {"text": "Elaboración de guías de venta", "completed": False},
                    {"text": "Producción de vídeos formativos", "completed": False},
                    {"text": "Sesiones de entrenamiento", "completed": False},
                    {"text": "Liderazgo activo de equipos", "completed": False}
                ],
                "deliverables": [
                    {"name": "Material de apoyo comercial"},
                    {"name": "Vídeos de formación"}
                ]
            },
            {
                "title": "Estrategia de Autogeneración",
                "description": "Project Managers 360º - Captación proactiva",
                "assigned_user_type": "comercial",
                "checklist": [
                    {"text": "Identificación de nichos", "completed": False},
                    {"text": "Maniobras de captación", "completed": False},
                    {"text": "Conversión de interés en matrículas", "completed": False},
                    {"text": "Posicionamiento como autoridad", "completed": False}
                ],
                "deliverables": [
                    {"name": "Plan de autogeneración"},
                    {"name": "Informe de resultados"}
                ]
            },
            {
                "title": "Cuadros de Mando Comercial",
                "description": "Seguimiento y reporting comercial",
                "assigned_user_type": "direccion",
                "checklist": [
                    {"text": "Estructuración de dashboards comerciales", "completed": False},
                    {"text": "Configuración de informes", "completed": False},
                    {"text": "Seguimiento de conversiones", "completed": False}
                ],
                "deliverables": [
                    {"name": "Dashboard comercial"},
                    {"name": "Informes de seguimiento"}
                ]
            }
        ]
    },
    "content": {
        "id": "content",
        "name": "Factoría de Contenidos y Cursos",
        "tasks": [
            {
                "title": "Diseño Instruccional",
                "description": "Diseño de estrategia pedagógica y contenidos",
                "assigned_user_type": "contenido",
                "checklist": [
                    {"text": "Diseño de estrategia pedagógica PreMáster", "completed": False},
                    {"text": "Diseño de estrategia pedagógica Máster", "completed": False},
                    {"text": "Coordinación de expertos", "completed": False},
                    {"text": "Producción de contenidos", "completed": False},
                    {"text": "Maquetación", "completed": False},
                    {"text": "Revisión y mejora", "completed": False}
                ],
                "deliverables": [
                    {"name": "Diseño instruccional completo"},
                    {"name": "Contenidos maquetados"}
                ]
            },
            {
                "title": "Preparación de Plataforma LMS",
                "description": "Diseño y parametrización de la plataforma de cursos",
                "assigned_user_type": "contenido",
                "checklist": [
                    {"text": "Diseño de plataforma", "completed": False},
                    {"text": "Parametrización", "completed": False},
                    {"text": "Diseño de cursos", "completed": False},
                    {"text": "Preparación de espacios", "completed": False}
                ],
                "deliverables": [
                    {"name": "Plataforma configurada"},
                    {"name": "Estructura de cursos"}
                ]
            },
            {
                "title": "Montaje de Contenidos en LMS",
                "description": "Carga y configuración de contenidos en la plataforma",
                "assigned_user_type": "contenido",
                "checklist": [
                    {"text": "Montaje de contenidos en módulos", "completed": False},
                    {"text": "Configuración de seguimiento", "completed": False},
                    {"text": "Configuración de dinamización", "completed": False},
                    {"text": "Diseño de evaluaciones", "completed": False},
                    {"text": "Parametrización de autoevaluaciones", "completed": False}
                ],
                "deliverables": [
                    {"name": "Contenidos montados"},
                    {"name": "Sistema de evaluación configurado"}
                ]
            },
            {
                "title": "Sistemas de Streaming para Videoclases",
                "description": "Diseño y producción de entornos síncronos",
                "assigned_user_type": "contenido",
                "checklist": [
                    {"text": "Diseño de entornos de videoclase", "completed": False},
                    {"text": "Producción de entornos síncronos", "completed": False},
                    {"text": "Integración con calendario", "completed": False},
                    {"text": "Pruebas de funcionamiento", "completed": False}
                ],
                "deliverables": [
                    {"name": "Entorno de videoclases operativo"},
                    {"name": "Manual para docentes"}
                ]
            }
        ]
    },
    "admin": {
        "id": "admin",
        "name": "Gestión Administrativa y Financiera",
        "tasks": [
            {
                "title": "Gestión de Prematrículas",
                "description": "Cobro y gestión de prematrículas",
                "assigned_user_type": "administracion",
                "checklist": [
                    {"text": "Configuración de sistema de cobro", "completed": False},
                    {"text": "Proceso de cobro de prematrículas", "completed": False},
                    {"text": "Seguimiento de pagos", "completed": False},
                    {"text": "Gestión de incidencias", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de prematrículas"},
                    {"name": "Dashboard de seguimiento"}
                ]
            },
            {
                "title": "Gestión de Cuotas de Financiación",
                "description": "Cobro de cuotas y gestión de impagos",
                "assigned_user_type": "administracion",
                "checklist": [
                    {"text": "Configuración de domiciliaciones", "completed": False},
                    {"text": "Cobro de cuotas mensuales", "completed": False},
                    {"text": "Gestión de impagos", "completed": False},
                    {"text": "Cuadros de seguimiento", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de cobros"},
                    {"name": "Informe de impagos"}
                ]
            },
            {
                "title": "Pagos a Docentes",
                "description": "Gestión de pagos a profesorado y colaboradores",
                "assigned_user_type": "administracion",
                "checklist": [
                    {"text": "Registro de docentes troncales", "completed": False},
                    {"text": "Registro de colaboradores externos", "completed": False},
                    {"text": "Procesamiento de pagos", "completed": False},
                    {"text": "Emisión de facturas", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de pagos a docentes"},
                    {"name": "Registro contable"}
                ]
            },
            {
                "title": "Comisiones Comerciales",
                "description": "Control y pago de comisiones al equipo comercial",
                "assigned_user_type": "administracion",
                "checklist": [
                    {"text": "Control de comisiones generadas", "completed": False},
                    {"text": "Validación de comisiones", "completed": False},
                    {"text": "Procesamiento de pagos", "completed": False},
                    {"text": "Informe de comisiones", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de comisiones"},
                    {"name": "Histórico de pagos"}
                ]
            }
        ]
    },
    "academic": {
        "id": "academic",
        "name": "Gestión Académica",
        "tasks": [
            {
                "title": "Calendarios Académicos",
                "description": "Elaboración y seguimiento de calendarios",
                "assigned_user_type": "academico",
                "checklist": [
                    {"text": "Preparación de calendario base", "completed": False},
                    {"text": "Apertura de módulos", "completed": False},
                    {"text": "Cierre de módulos", "completed": False},
                    {"text": "Seguimiento continuo", "completed": False}
                ],
                "deliverables": [
                    {"name": "Calendario académico completo"},
                    {"name": "Informe de cumplimiento"}
                ]
            },
            {
                "title": "Coordinación Docente",
                "description": "Coordinación del profesorado de cada módulo",
                "assigned_user_type": "academico",
                "checklist": [
                    {"text": "Asignación de profesorado", "completed": False},
                    {"text": "Revisión de contenidos por edición", "completed": False},
                    {"text": "Coordinación con expertos externos", "completed": False},
                    {"text": "Seguimiento de correcciones y feedbacks", "completed": False}
                ],
                "deliverables": [
                    {"name": "Plan de coordinación docente"},
                    {"name": "Informe de seguimiento"}
                ]
            },
            {
                "title": "Dinamización de la Impartición",
                "description": "Dinamización y seguimiento personalizado",
                "assigned_user_type": "academico",
                "checklist": [
                    {"text": "Dinamización del grupo", "completed": False},
                    {"text": "Seguimiento personalizado de alumnos", "completed": False},
                    {"text": "Enlace con profesorado", "completed": False},
                    {"text": "Enlace con dirección académica", "completed": False},
                    {"text": "Enlace con administración", "completed": False}
                ],
                "deliverables": [
                    {"name": "Informe de dinamización"},
                    {"name": "Seguimiento de alumnos"}
                ]
            },
            {
                "title": "Actas e Informes Académicos",
                "description": "Elaboración de documentación académica oficial",
                "assigned_user_type": "academico",
                "checklist": [
                    {"text": "Elaboración de actas", "completed": False},
                    {"text": "Informes académicos", "completed": False},
                    {"text": "Documentación para Universidad", "completed": False},
                    {"text": "Gestión de calidad docente", "completed": False}
                ],
                "deliverables": [
                    {"name": "Actas oficiales"},
                    {"name": "Informes académicos"},
                    {"name": "Documentación universitaria"}
                ]
            }
        ]
    }
}

# ============= HELPER FUNCTIONS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ============= CONFIG LOADERS =============

async def get_user_types_from_db():
    """Load user types from DB, fallback to defaults"""
    types = await db.config_user_types.find({}, {"_id": 0}).to_list(100)
    if not types:
        # Initialize with defaults
        for ut in DEFAULT_USER_TYPES:
            await db.config_user_types.insert_one(ut)
        return DEFAULT_USER_TYPES
    return types

async def get_roles_from_db():
    """Load roles from DB, fallback to defaults"""
    roles = await db.config_roles.find({}, {"_id": 0}).to_list(100)
    if not roles:
        # Initialize with defaults
        for role in DEFAULT_ROLES:
            await db.config_roles.insert_one(role)
        return DEFAULT_ROLES
    return roles

async def get_modules_from_db():
    """Load modules from DB, fallback to hardcoded MODULE_TEMPLATES"""
    modules = await db.config_modules.find({}, {"_id": 0}).to_list(100)
    if not modules:
        # Initialize with MODULE_TEMPLATES
        for module_id, module_data in MODULE_TEMPLATES.items():
            module_doc = {
                "id": module_id,
                "name": module_data["name"],
                "description": "",
                "icon": get_module_icon(module_id),
                "color": get_module_color(module_id),
                "tasks": module_data["tasks"]
            }
            await db.config_modules.insert_one(module_doc)
        return await db.config_modules.find({}, {"_id": 0}).to_list(100)
    return modules

def get_module_icon(module_id):
    icons = {
        "design": "Palette",
        "tech": "Code",
        "marketing": "Megaphone",
        "sales": "Users",
        "content": "BookOpen",
        "admin": "Calculator",
        "academic": "GraduationCap"
    }
    return icons.get(module_id, "Package")

def get_module_color(module_id):
    colors = {
        "design": "pink",
        "tech": "blue",
        "marketing": "purple",
        "sales": "emerald",
        "content": "amber",
        "admin": "slate",
        "academic": "cyan"
    }
    return colors.get(module_id, "slate")

def format_date_eu(date_str):
    if not date_str:
        return "Pendiente"
    try:
        # Si ya viene en formato ISO YYYY-MM-DD
        if "-" in date_str and len(date_str) >= 10:
            parts = date_str[:10].split("-")
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
    except:
        pass
    return date_str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de administrador")
    return current_user

async def require_manager_or_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ["admin", "project_manager"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de administrador o project manager")
    return current_user

async def create_notification(user_id: str, type: str, title: str, message: str, project_id: str = None):
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        project_id=project_id
    )
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    return notification

def get_email_template(title, content, button_text=None, button_url=None):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            .container {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; }}
            .header {{ text-align: center; padding: 20px 0; border-bottom: 2px solid #f1f5f9; }}
            .logo {{ color: #4f46e5; font-size: 24px; font-weight: bold; text-decoration: none; }}
            .content {{ padding: 30px 0; line-height: 1.6; }}
            .title {{ font-size: 22px; font-weight: bold; color: #0f172a; margin-bottom: 20px; }}
            .card {{ background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }}
            .btn {{ display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }}
            .footer {{ text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <a href="#" class="logo">learning360</a>
            </div>
            <div class="content">
                <div class="title">{title}</div>
                {content}
                {f'<center><a href="{button_url}" class="btn">{button_text}</a></center>' if button_text and button_url else ''}
            </div>
            <div class="footer">
                &copy; 2024 Innova eLearning 360. Todos los derechos reservados.<br>
                Este es un correo automático, por favor no respondas directamente.
            </div>
        </div>
    </body>
    </html>
    """

async def send_email_notification(to_email: str, subject: str, title: str, content: str, button_text=None, button_url=None):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return
    
    html_content = get_email_template(title, content, button_text, button_url)
    
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
async def get_notification_subscribers(user_type=None):
    """
    Returns a list of users who should be 'copied' on notifications:
    1. Users with user_type: 'direccion'
    2. Users with role: 'project_manager' and matching user_type
    """
    subscribers = []
    
    # 1. Dirección (siempre reciben todo)
    direccion_users = await db.users.find({"user_type": "direccion"}).to_list(100)
    subscribers.extend(direccion_users)
    
    # 2. Responsables de grupo (Project Managers del departamento)
    if user_type:
        responsables = await db.users.find({
            "role": "project_manager",
            "user_type": user_type
        }).to_list(100)
        
        # Evitar duplicados
        ids = {u["id"] for u in subscribers}
        for r in responsables:
            if r["id"] not in ids:
                subscribers.append(r)
                
    return subscribers

async def generate_tasks_for_modules_async(project_id: str, modules: List[str], end_date: str) -> List[dict]:
    """Generate tasks from DB-stored module templates"""
    tasks = []
    db_modules = await get_modules_from_db()
    modules_dict = {m["id"]: m for m in db_modules}
    
    for module_id in modules:
        if module_id in modules_dict:
            template = modules_dict[module_id]
            for task_template in template.get("tasks", []):
                # Create deliverables with full structure
                deliverables = []
                for item in task_template.get("deliverables", []):
                    name = item.get("name", item) if isinstance(item, dict) else item
                    deliverables.append({
                        "id": str(uuid.uuid4()),
                        "name": name,
                        "description": "",
                        "status": "pending",
                        "due_date": end_date,
                        "file_name": None,
                        "file_url": None,
                        "file_size": None,
                        "file_type": None,
                        "uploaded_at": None,
                        "uploaded_by": None,
                        "feedback": None,
                        "reviewed_by": None,
                        "reviewed_at": None
                    })
                
                # Process checklist
                checklist = []
                for item in task_template.get("checklist", []):
                    if isinstance(item, dict):
                        checklist.append({**item, "id": str(uuid.uuid4())})
                    else:
                        checklist.append({"id": str(uuid.uuid4()), "text": item, "completed": False})
                
                task = Task(
                    project_id=project_id,
                    module_id=module_id,
                    title=task_template.get("title", ""),
                    description=task_template.get("description", ""),
                    checklist=checklist,
                    deliverables=deliverables,
                    due_date=end_date,
                    assigned_user_type=task_template.get("assigned_user_type")
                )
                task_doc = task.model_dump()
                task_doc['created_at'] = task_doc['created_at'].isoformat()
                tasks.append(task_doc)
    return tasks


# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Check if it's the first user (make admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else user_data.role
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=role,
        user_type=user_data.user_type
    )
    
    doc = user.model_dump()
    doc['password_hash'] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    token = create_token(user.id, user.email, role)
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": role,
            "user_type": user.user_type
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user["id"], user["email"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "user_type": user.get("user_type")
        }
    }

@api_router.post("/auth/forgot-password")
async def request_password_reset(request: PasswordResetRequest):
    try:
        user = await db.users.find_one({"email": request.email})
        if not user:
            # Don't reveal if user exists
            return {"message": "Si el email existe, recibirás un correo con instrucciones"}
        
        # Generate reset token (valid for 1 hour)
        token = jwt.encode({
            "sub": user["email"],
            "type": "reset_password",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Reset link
        reset_link = f"http://localhost:3000/reset-password?token={token}"
        
        # Send email
        await send_email_notification(
            user["email"],
            "Restablecer Contraseña - eLearning 360",
            f"""
            <h2>Hola {user['name']}</h2>
            <p>Has solicitado restablecer tu contraseña.</p>
            <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
            <a href="{reset_link}">{reset_link}</a>
            <p>Este enlace expirará en 1 hora.</p>
            <p>Si no has solicitado esto, puedes ignorar este correo.</p>
            """
        )
        
        logger.info(f"Password reset requested for {user['email']}. Token: {token}")
        
        return {"message": "Si el email existe, recibirás un correo con instrucciones"}
    except Exception as e:
        logger.error(f"Error in request_password_reset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@api_router.post("/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
    try:
        payload = jwt.decode(data.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "reset_password":
            raise HTTPException(status_code=400, detail="Token inválido")
            
        email = payload.get("sub")
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        # Update password
        password_hash = hash_password(data.new_password)
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": password_hash}}
        )
        
        return {"message": "Contraseña actualizada correctamente"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="El enlace ha expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Enlace inválido")

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============= USER ENDPOINTS =============

@api_router.get("/users")
async def get_users(current_user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario actualizado"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado"}

# ============= PROJECT ENDPOINTS =============

@api_router.get("/projects")
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    is_management = current_user.get("role") in ["admin", "project_manager"]
    
    # Calculate progress for each project and scrub financial data if needed
    for project in projects:
        tasks = await db.tasks.find({"project_id": project["id"]}, {"_id": 0}).to_list(1000)
        if tasks:
            completed = sum(1 for t in tasks if t["status"] == "completed")
            project["progress"] = round((completed / len(tasks)) * 100, 1)
            project["total_tasks"] = len(tasks)
            project["completed_tasks"] = completed
        else:
            project["progress"] = 0
            project["total_tasks"] = 0
            project["completed_tasks"] = 0
            
        if not is_management:
            project.pop("total_project_cost", None)
            project.pop("enrollment_payment", None)
            project.pop("module_costs", None)
            project.pop("cost_per_module", None)
            project.pop("billing_mode", None)
    
    return projects

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Get tasks
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    # Calculate progress
    if tasks:
        completed = sum(1 for t in tasks if t["status"] == "completed")
        project["progress"] = round((completed / len(tasks)) * 100, 1)
        project["total_tasks"] = len(tasks)
        project["completed_tasks"] = completed
    else:
        project["progress"] = 0
        project["total_tasks"] = 0
        project["completed_tasks"] = 0
    
    # Fetch official modules from DB to respect their order and get latest names
    db_modules = await db.config_modules.find({}, {"_id": 0}).to_list(100)
    modules_metadata = {m["id"]: m["name"] for m in db_modules}
    ordered_ids = [m["id"] for m in db_modules]

    # Sort project modules based on official admin order
    project_modules = project.get("modules", [])
    project_modules.sort(key=lambda x: ordered_ids.index(x) if x in ordered_ids else 999)
    project["modules"] = project_modules
    
    # Group tasks by module
    modules_data = {}
    for module_id in project["modules"]:
        if module_id in modules_metadata:
            module_tasks = [t for t in tasks if t["module_id"] == module_id]
            modules_data[module_id] = {
                "id": module_id,
                "name": modules_metadata[module_id],
                "tasks": module_tasks,
                "total": len(module_tasks),
                "completed": sum(1 for t in module_tasks if t["status"] == "completed")
            }
    
    project["modules_data"] = modules_data
    
    # Scrub financial data if user is not management
    if current_user.get("role") not in ["admin", "project_manager"]:
        project.pop("total_project_cost", None)
        project.pop("enrollment_payment", None)
        project.pop("module_costs", None)
        project.pop("cost_per_module", None)
        project.pop("billing_mode", None)
        
    return project

@api_router.post("/projects")
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(require_manager_or_admin)):
    # Calculate module costs if not provided
    module_costs = project_data.module_costs or {}
    for module_id in project_data.modules:
        if module_id not in module_costs:
            module_costs[module_id] = DEFAULT_MODULE_COSTS.get(module_id, 0.0)
            
    # Calculate total cost based on billing mode
    total_cost = 0.0
    if project_data.billing_mode == "project":
        total_cost = project_data.total_project_cost
    else:
        total_cost = sum(module_costs.values())

    project = Project(
        name=project_data.name,
        client_name=project_data.client_name,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        modules=project_data.modules,
        module_costs=module_costs,
        billing_mode=project_data.billing_mode,
        description=project_data.description or "",
        cost_per_module=project_data.cost_per_module, # Keep for backward compatibility if needed
        total_project_cost=total_cost,
        enrollment_payment=project_data.enrollment_payment,
        created_by=current_user["id"]
    )
    
    doc = project.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.projects.insert_one(doc)
    
    # Generate tasks for selected modules (from DB config)
    tasks = await generate_tasks_for_modules_async(project.id, project_data.modules, project_data.end_date)
    if tasks:
        await db.tasks.insert_many(tasks)
    
    # Notify all users about new project
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for user in users:
        await create_notification(
            user_id=user["id"],
            type="project_created",
            title="Nuevo Proyecto Creado",
            message=f"Se ha creado el proyecto '{project.name}' para {project.client_name}",
            project_id=project.id
        )
        # Enviar Email de creación
        await send_email_notification(
            to_email=user["email"],
            subject=f"Nuevo Proyecto: {project.name}",
            title="🎯 ¡Nuevo Proyecto en Marcha!",
            content=f"""
            <p>Se ha creado un nuevo proyecto en el que podrías estar involucrado:</p>
            <div class="card">
                <strong>Proyecto:</strong> {project.name}<br>
                <strong>Cliente:</strong> {project.client_name}<br>
                <strong>Cierre:</strong> {format_date_eu(project.end_date)}
            </div>
            <p>Accede ahora para revisar los objetivos y cronograma.</p>
            """,
            button_text="Ver Proyecto",
            button_url=f"http://localhost:5173/projects/{project.id}"
        )
    
    # Remove MongoDB _id field for JSON serialization
    doc.pop('_id', None)
    
    return {
        "message": "Proyecto creado exitosamente",
        "project": doc,
        "tasks_created": len(tasks)
    }

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: dict = Depends(require_manager_or_admin)):
    # 1. Get current project
    current_project = await db.projects.find_one({"id": project_id})
    if not current_project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    update_data = {k: v for k, v in project_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    # 2. Handle Module Changes
    if "modules" in update_data:
        new_modules_list = update_data["modules"]
        old_modules_list = current_project.get("modules", [])
        
        # Find newly added modules
        modules_to_add = [m for m in new_modules_list if m not in old_modules_list]
        # Find removed modules
        modules_to_remove = [m for m in old_modules_list if m not in new_modules_list]
        
        if modules_to_add:
            # Generate tasks ONLY for the new modules
            end_date = update_data.get("end_date", current_project["end_date"])
            new_tasks = await generate_tasks_for_modules_async(project_id, modules_to_add, end_date)
            if new_tasks:
                await db.tasks.insert_many(new_tasks)
            
            logger.info(f"Generated {len(new_tasks)} tasks for new modules in project {project_id}")

        if modules_to_remove:
            # Delete tasks associated with removed modules
            delete_result = await db.tasks.delete_many({
                "project_id": project_id,
                "module_id": {"$in": modules_to_remove}
            })
            logger.info(f"Deleted {delete_result.deleted_count} tasks for removed modules {modules_to_remove} in project {project_id}")

        # Ensure module_costs exists for all new modules
        current_module_costs = current_project.get("module_costs", {})
        # Merge if user sent updates to costs
        if "module_costs" in update_data:
             current_module_costs.update(update_data["module_costs"])
        
        # Add default costs for new modules if not present
        for m in new_modules_list:
            if m not in current_module_costs:
                current_module_costs[m] = DEFAULT_MODULE_COSTS.get(m, 0.0)
        
        # Filter costs for only the current modules list
        final_module_costs = {m: current_module_costs.get(m, 0.0) for m in new_modules_list}
        update_data["module_costs"] = final_module_costs
        
        # update total if mode is module
        current_mode = update_data.get("billing_mode", current_project.get("billing_mode", "module"))
        if current_mode == "module":
            update_data["total_project_cost"] = sum(final_module_costs.values())

    elif "module_costs" in update_data:
        # If modules list didn't change but costs did
        current_modules = current_project.get("modules", [])
        new_costs = update_data["module_costs"]
        
        current_mode = update_data.get("billing_mode", current_project.get("billing_mode", "module"))
        if current_mode == "module":
            update_data["total_project_cost"] = sum(new_costs.values())

    # Handle explicit billing mode change or total cost update
    if "billing_mode" in update_data:
        # If switching to module, recalculate total from existing/updated costs
        if update_data["billing_mode"] == "module":
            # Use updated costs if available, else current
            costs_to_sum = update_data.get("module_costs", current_project.get("module_costs", {}))
            update_data["total_project_cost"] = sum(costs_to_sum.values())
        # If switching to project, we expect total_project_cost to be provided or stay as is
    
    # If mode is project and total_project_cost is provided, use it (already in update_data)


    # 3. Update project
    result = await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    return {"message": "Proyecto actualizado"}

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(require_admin)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Delete all tasks associated with the project
    await db.tasks.delete_many({"project_id": project_id})
    
    return {"message": "Proyecto y tareas eliminados"}

# ============= TASK ENDPOINTS =============

@api_router.get("/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str, current_user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return tasks

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_update: TaskUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    # Get original task for notification
    original_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not original_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Refresh task data to have latest assigned_to/assigned_user_type
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    
    # If task was assigned, notify the user(s)
    new_user_type = task.get("assigned_user_type")
    new_assigned_to = task.get("assigned_to")
    old_user_type = original_task.get("assigned_user_type")
    old_assigned_to = original_task.get("assigned_to")

    target_users = []
    project_name = "Proyecto"
    project = await db.projects.find_one({"id": original_task["project_id"]})
    if project:
        project_name = project.get("name", "Proyecto")

    # Case 1: A specific user is assigned (new or changed)
    if new_assigned_to and new_assigned_to != old_assigned_to:
        user = await db.users.find_one({"id": new_assigned_to}, {"_id": 0})
        if user and user["id"] != current_user["id"]:
            target_users = [user]
            
    # Case 2: No specific user assigned, but department is set or changed
    elif new_user_type and not new_assigned_to:
        # Notify if department changed OR if a specific user was just removed
        if new_user_type != old_user_type or (old_assigned_to and not new_assigned_to):
            target_users = await db.users.find({"user_type": new_user_type}).to_list(100)
            target_users = [u for u in target_users if u["id"] != current_user["id"]]

    # Collect all people to notify
    recipients = {u["id"]: u for u in target_users}
    
    # Check for newly completed checklist items
    new_completed_items = []
    if "checklist" in update_data:
        old_checklist = {item["id"]: item for item in original_task.get("checklist", [])}
        for item in update_data["checklist"]:
            if item.get("completed") and not old_checklist.get(item["id"], {}).get("completed"):
                new_completed_items.append(item["text"])

    # Add Supervisors (Dirección always, PMs if assignment changed, completed or checklist item completed)
    if new_user_type != old_user_type or new_assigned_to != old_assigned_to or update_data.get("status") == "completed" or new_completed_items:
        supervisors = await get_notification_subscribers(new_user_type)
        for s in supervisors:
            if s["id"] not in recipients and s["id"] != current_user["id"]:
                recipients[s["id"]] = s

    for user in recipients.values():
        is_assigned_nominal = user["id"] == new_assigned_to
        
        # Build specific message for checklist items
        subject_action = "Actualización"
        if update_data.get("status") == "completed":
            subject_action = "✅ Finalizada"
        elif new_completed_items:
            subject_action = f"📈 Progreso ({len(new_completed_items)} puntos)"

        await create_notification(
            user_id=user["id"],
            type="task_assignment_update",
            title=f"Tarea: {subject_action}",
            message=f"Cambio en '{task['title']}' ({project_name})",
            project_id=original_task["project_id"]
        )
        # Enviar Email Personalizado
        content_html = f"""
            <p>Hola {user['name']}, hay novedades en una tarea de <strong>learning360</strong>:</p>
            <div class="card">
                <strong>Tarea:</strong> {task['title']}<br>
                <strong>Proyecto:</strong> {project_name}<br>
                <strong>Estado:</strong> {task['status'].replace('_', ' ').capitalize()}<br>
                <strong>Responsable:</strong> {user['name'] if is_assigned_nominal else (new_user_type or 'General')}
            </div>
        """
        
        if new_completed_items:
            content_html += f"""
            <p><strong>Puntos completados recientemente:</strong></p>
            <ul>
                {"".join([f"<li>✅ {item}</li>" for item in new_completed_items])}
            </ul>
            """

        await send_email_notification(
            to_email=user["email"],
            subject=f"[{subject_action}] {task['title']}",
            title="🎯 Avance en Tarea" if new_completed_items else "📝 Actualización",
            content=content_html,
            button_text="Ver Tarea",
            button_url=f"http://localhost:5173/projects/{original_task['project_id']}"
        )

    return {"message": "Tarea actualizada y notificaciones enviadas"}

    return {"message": "Tarea actualizada y notificaciones enviadas"}

@api_router.post("/projects/{project_id}/tasks")
async def create_task(project_id: str, task_data: TaskCreate, current_user: dict = Depends(require_manager_or_admin)):
    # Check project exists
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    task = Task(
        project_id=project_id,
        module_id=task_data.module_id,
        title=task_data.title,
        description=task_data.description or "",
        due_date=task_data.due_date,
        assigned_to=task_data.assigned_to,
        checklist=[{**item, "id": str(uuid.uuid4())} for item in task_data.checklist],
        deliverables=[{**item, "id": str(uuid.uuid4())} for item in task_data.deliverables]
    )
    
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.tasks.insert_one(doc)
    
    # Remove MongoDB _id field for JSON serialization
    doc.pop('_id', None)
    
    return {"message": "Tarea creada", "task": doc}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(require_manager_or_admin)):
    """Delete a task and its associated deliverable files"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Clean up files from disk
    for deliverable in task.get("deliverables", []):
        if deliverable.get("file_url"):
            file_name = deliverable["file_url"].split("/")[-1]
            file_path = UPLOADS_DIR / file_name
            if file_path.exists():
                file_path.unlink()
    
    await db.tasks.delete_one({"id": task_id})
    return {"message": "Tarea eliminada exitosamente"}
@api_router.get("/tasks")
async def get_tasks(status: Optional[str] = None, assigned_to: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        if status == "pending_all":
            query["status"] = {"$in": ["pending", "in_progress"]}
        else:
            query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    # Filter: Only tasks from projects with status 'active' or 'on_hold'
    valid_projects = await db.projects.find(
        {"status": {"$in": ["active", "on_hold"]}}, 
        {"id": 1}
    ).to_list(1000)
    valid_project_ids = [p["id"] for p in valid_projects]
    query["project_id"] = {"$in": valid_project_ids}
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrichment
    project_ids = list(set([t["project_id"] for t in tasks]))
    projects = await db.projects.find({"id": {"$in": project_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(100)
    project_map = {p["id"]: p["name"] for p in projects}
    
    db_modules = await get_modules_from_db()
    module_names_map = {m["id"]: m["name"] for m in db_modules}
    module_colors_map = {m["id"]: m["color"] for m in db_modules}
    
    for t in tasks:
        t["project_name"] = project_map.get(t["project_id"], "Desconocido")
        m_id = t.get("module_id")
        t["module_name"] = module_names_map.get(m_id, "General")
        t["module_color"] = module_colors_map.get(m_id, "bg-slate-100 text-slate-500")
        
    return tasks

# ============= DELIVERABLE ENDPOINTS =============

@api_router.get("/projects/{project_id}/deliverables")
async def get_project_deliverables(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get all deliverables for a project across all tasks"""
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    deliverables = []
    for task in tasks:
        for deliverable in task.get("deliverables", []):
            deliverables.append({
                **deliverable,
                "task_id": task["id"],
                "task_title": task["title"],
                "module_id": task["module_id"]
            })
    
    return deliverables

@api_router.get("/tasks/{task_id}/deliverables")
async def get_task_deliverables(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get all deliverables for a specific task"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task.get("deliverables", [])

@api_router.post("/tasks/{task_id}/deliverables")
async def create_deliverable(task_id: str, deliverable_data: DeliverableCreate, current_user: dict = Depends(get_current_user)):
    """Create a new deliverable for a task"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    new_deliverable = {
        "id": str(uuid.uuid4()),
        "name": deliverable_data.name,
        "description": deliverable_data.description or "",
        "status": "pending",
        "due_date": deliverable_data.due_date,
        "file_name": None,
        "file_url": None,
        "file_size": None,
        "file_type": None,
        "uploaded_at": None,
        "uploaded_by": None,
        "feedback": None,
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    deliverables = task.get("deliverables", [])
    deliverables.append(new_deliverable)
    
    await db.tasks.update_one({"id": task_id}, {"$set": {"deliverables": deliverables}})
    
    return {"message": "Entregable creado", "deliverable": new_deliverable}

@api_router.put("/tasks/{task_id}/deliverables/{deliverable_id}")
async def update_deliverable(task_id: str, deliverable_id: str, update_data: DeliverableUpdate, current_user: dict = Depends(get_current_user)):
    """Update a deliverable's metadata"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    deliverables = task.get("deliverables", [])
    updated = False
    
    for i, d in enumerate(deliverables):
        if d["id"] == deliverable_id:
            for key, value in update_data.model_dump().items():
                if value is not None:
                    deliverables[i][key] = value
            
            # If status changed to approved/rejected, record reviewer
            if update_data.status in ["approved", "rejected"]:
                deliverables[i]["reviewed_by"] = current_user["id"]
                deliverables[i]["reviewed_at"] = datetime.now(timezone.utc).isoformat()
            
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    
    await db.tasks.update_one({"id": task_id}, {"$set": {"deliverables": deliverables}})
    
    # Notify owner of deliverable if status changed (Approved/Rejected)
    if update_data.status in ["approved", "rejected"]:
        target_deliverable = next((d for d in deliverables if d["id"] == deliverable_id), None)
        if target_deliverable:
            status_label = "APROBADO ✅" if update_data.status == "approved" else "RECHAZADO ❌"
            color = "#059669" if update_data.status == "approved" else "#dc2626"
            
            # 1. Notify Owner
            recipients = []
            if target_deliverable.get("uploaded_by"):
                owner = await db.users.find_one({"id": target_deliverable["uploaded_by"]})
                if owner: recipients.append(owner)
            
            # 2. Notify Supervisors (Dirección + PMs of the group)
            supervisors = await get_notification_subscribers(task.get("user_type"))
            for s in supervisors:
                if s["id"] not in [r["id"] for r in recipients] and s["id"] != current_user["id"]:
                    recipients.append(s)

            for user in recipients:
                await send_email_notification(
                    to_email=user["email"],
                    subject=f"Revisión: {target_deliverable['name']}",
                    title="📋 Revisión de Entregable",
                    content=f"""
                    <p>El entregable <strong>{target_deliverable['name']}</strong> ha sido revisado:</p>
                    <div class="card">
                        <strong>Estado:</strong> <span style="color: {color}; font-weight: bold;">{status_label}</span><br>
                        <strong>Revisado por:</strong> {current_user['name']}<br>
                        <strong>Feedback:</strong> {target_deliverable.get('feedback', 'Sin comentarios')}
                    </div>
                    """,
                    button_text="Ver Proyecto",
                    button_url=f"http://localhost:5173/projects/{task['project_id']}"
                )

    return {"message": "Entregable actualizado"}

@api_router.post("/tasks/{task_id}/deliverables/{deliverable_id}/upload")
async def upload_deliverable_file(
    task_id: str, 
    deliverable_id: str, 
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to a deliverable"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    deliverables = task.get("deliverables", [])
    deliverable_idx = None
    
    for i, d in enumerate(deliverables):
        if d["id"] == deliverable_id:
            deliverable_idx = i
            break
    
    if deliverable_idx is None:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    
    # Save file
    file_ext = Path(file.filename).suffix
    unique_filename = f"{deliverable_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    file_size = file_path.stat().st_size
    
    # Update deliverable
    deliverables[deliverable_idx].update({
        "file_name": file.filename,
        "file_url": f"/api/uploads/{unique_filename}",
        "file_size": file_size,
        "file_type": file.content_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user["id"],
        "status": "in_review" if deliverables[deliverable_idx]["status"] == "pending" else deliverables[deliverable_idx]["status"]
    })
    
    await db.tasks.update_one({"id": task_id}, {"$set": {"deliverables": deliverables}})
    
    # Create notification for project managers
    project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
    if project:
        managers = await db.users.find({"role": {"$in": ["admin", "project_manager"]}}, {"_id": 0}).to_list(100)
        for manager in managers:
            if manager["id"] != current_user["id"]:
                await create_notification(
                    user_id=manager["id"],
                    type="deliverable_uploaded",
                    title="Nuevo Entregable Subido",
                    message=f"{current_user['name']} ha subido '{file.filename}' en el proyecto {project['name']}",
                    project_id=project["id"]
                )
                # Enviar Email a gestores y suscriptores (Dirección + PMs)
                supervisors = await get_notification_subscribers(task.get("module_id"))
                all_managers = {m["id"]: m for m in managers}
                for s in supervisors:
                    all_managers[s["id"]] = s

                for mgr in all_managers.values():
                    if mgr["id"] != current_user["id"]:
                        await send_email_notification(
                            to_email=mgr["email"],
                            subject=f"Pendiente de Revisión: {file.filename}",
                            title="📂 Nuevo Archivo Recibido",
                            content=f"""
                            <p>{current_user['name']} ha subido un archivo que requiere supervisión:</p>
                            <div class="card">
                                <strong>Proyecto:</strong> {project['name']}<br>
                                <strong>Tarea:</strong> {task['title']}<br>
                                <strong>Archivo:</strong> {file.filename}
                            </div>
                            """,
                            button_text="Revisar Ahora",
                            button_url=f"http://localhost:5173/projects/{project['id']}"
                        )
    
    return {
        "message": "Archivo subido correctamente",
        "file_url": f"/api/uploads/{unique_filename}",
        "file_name": file.filename
    }

@api_router.delete("/tasks/{task_id}/deliverables/{deliverable_id}")
async def delete_deliverable(task_id: str, deliverable_id: str, current_user: dict = Depends(require_manager_or_admin)):
    """Delete a deliverable"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    deliverables = task.get("deliverables", [])
    original_length = len(deliverables)
    
    # Find and remove file if exists
    for d in deliverables:
        if d["id"] == deliverable_id and d.get("file_url"):
            file_name = d["file_url"].split("/")[-1]
            file_path = UPLOADS_DIR / file_name
            if file_path.exists():
                file_path.unlink()
    
    deliverables = [d for d in deliverables if d["id"] != deliverable_id]
    
    if len(deliverables) == original_length:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    
    await db.tasks.update_one({"id": task_id}, {"$set": {"deliverables": deliverables}})
    
    return {"message": "Entregable eliminado"}

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded files"""
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path)

# ============= NOTIFICATION ENDPOINTS =============

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"message": "Notificación marcada como leída"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Todas las notificaciones marcadas como leídas"}

# ============= MODULE TEMPLATES ENDPOINT =============

@api_router.get("/modules")
async def get_modules():
    """Get all modules from DB config"""
    modules = await get_modules_from_db()
    return [{
        "id": m["id"],
        "name": m["name"],
        "description": m.get("description", ""),
        "icon": m.get("icon", "Package"),
        "color": m.get("color", "slate"),
        "tasks_count": len(m.get("tasks", []))
    } for m in modules]

@api_router.get("/user-types")
async def get_user_types():
    """Get all available user types for task assignment"""
    return await get_user_types_from_db()

@api_router.get("/roles")
async def get_roles():
    """Get all available roles"""
    return await get_roles_from_db()

# ============= ADMIN ENDPOINTS =============

# --- User Types Admin ---
@api_router.get("/admin/user-types")
async def admin_get_user_types(current_user: dict = Depends(require_admin)):
    return await get_user_types_from_db()

@api_router.post("/admin/user-types")
async def admin_create_user_type(data: UserTypeConfig, current_user: dict = Depends(require_admin)):
    # Check if ID exists
    existing = await db.config_user_types.find_one({"id": data.id})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un tipo de usuario con ese ID")
    
    await db.config_user_types.insert_one(data.model_dump())
    return {"message": "Tipo de usuario creado", "user_type": data.model_dump()}

@api_router.put("/admin/user-types/{type_id}")
async def admin_update_user_type(type_id: str, data: UserTypeConfig, current_user: dict = Depends(require_admin)):
    result = await db.config_user_types.update_one({"id": type_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tipo de usuario no encontrado")
    return {"message": "Tipo de usuario actualizado"}

@api_router.delete("/admin/user-types/{type_id}")
async def admin_delete_user_type(type_id: str, current_user: dict = Depends(require_admin)):
    result = await db.config_user_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tipo de usuario no encontrado")
    return {"message": "Tipo de usuario eliminado"}

# --- Roles Admin ---
@api_router.get("/admin/roles")
async def admin_get_roles(current_user: dict = Depends(require_admin)):
    return await get_roles_from_db()

@api_router.post("/admin/roles")
async def admin_create_role(data: RoleConfig, current_user: dict = Depends(require_admin)):
    existing = await db.config_roles.find_one({"id": data.id})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un rol con ese ID")
    
    await db.config_roles.insert_one(data.model_dump())
    return {"message": "Rol creado", "role": data.model_dump()}

@api_router.put("/admin/roles/{role_id}")
async def admin_update_role(role_id: str, data: RoleConfig, current_user: dict = Depends(require_admin)):
    result = await db.config_roles.update_one({"id": role_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return {"message": "Rol actualizado"}

@api_router.delete("/admin/roles/{role_id}")
async def admin_delete_role(role_id: str, current_user: dict = Depends(require_admin)):
    # Don't allow deleting built-in roles
    if role_id in ["admin", "project_manager", "collaborator"]:
        raise HTTPException(status_code=400, detail="No se pueden eliminar los roles del sistema")
    
    result = await db.config_roles.delete_one({"id": role_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return {"message": "Rol eliminado"}

# --- Modules Admin ---
@api_router.get("/admin/modules")
async def admin_get_modules(current_user: dict = Depends(require_admin)):
    return await get_modules_from_db()

@api_router.post("/admin/modules")
async def admin_create_module(data: ModuleCreate, current_user: dict = Depends(require_admin)):
    # Generate ID from name
    module_id = data.name.lower().replace(" ", "_")[:20]
    
    existing = await db.config_modules.find_one({"id": module_id})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un módulo con ese nombre")
    
    module_doc = {
        "id": module_id,
        "name": data.name,
        "description": data.description,
        "icon": data.icon,
        "color": data.color,
        "tasks": []
    }
    await db.config_modules.insert_one(module_doc)
    # Remove MongoDB _id before returning
    module_doc.pop('_id', None)
    return {"message": "Módulo creado", "module": module_doc}

@api_router.put("/admin/modules/{module_id}")
async def admin_update_module(module_id: str, data: ModuleUpdate, current_user: dict = Depends(require_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    result = await db.config_modules.update_one({"id": module_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return {"message": "Módulo actualizado"}

@api_router.delete("/admin/modules/{module_id}")
async def admin_delete_module(module_id: str, current_user: dict = Depends(require_admin)):
    result = await db.config_modules.delete_one({"id": module_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return {"message": "Módulo eliminado"}

# --- Task Templates Admin ---
@api_router.get("/admin/modules/{module_id}/tasks")
async def admin_get_module_tasks(module_id: str, current_user: dict = Depends(require_admin)):
    module = await db.config_modules.find_one({"id": module_id}, {"_id": 0})
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    return module.get("tasks", [])

@api_router.post("/admin/modules/{module_id}/tasks")
async def admin_create_task_template(module_id: str, data: TaskTemplateCreate, current_user: dict = Depends(require_admin)):
    module = await db.config_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    task_template = {
        "id": str(uuid.uuid4()),
        **data.model_dump()
    }
    
    tasks = module.get("tasks", [])
    tasks.append(task_template)
    
    await db.config_modules.update_one({"id": module_id}, {"$set": {"tasks": tasks}})
    return {"message": "Tarea template creada", "task": task_template}

@api_router.put("/admin/modules/{module_id}/tasks/{task_id}")
async def admin_update_task_template(module_id: str, task_id: str, data: TaskTemplateUpdate, current_user: dict = Depends(require_admin)):
    module = await db.config_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    tasks = module.get("tasks", [])
    updated = False
    
    for i, task in enumerate(tasks):
        if task.get("id") == task_id or task.get("title") == task_id:
            for key, value in data.model_dump().items():
                if value is not None:
                    tasks[i][key] = value
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Tarea template no encontrada")
    
    await db.config_modules.update_one({"id": module_id}, {"$set": {"tasks": tasks}})
    return {"message": "Tarea template actualizada"}

@api_router.delete("/admin/modules/{module_id}/tasks/{task_id}")
async def admin_delete_task_template(module_id: str, task_id: str, current_user: dict = Depends(require_admin)):
    module = await db.config_modules.find_one({"id": module_id})
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    
    tasks = module.get("tasks", [])
    original_len = len(tasks)
    tasks = [t for t in tasks if t.get("id") != task_id and t.get("title") != task_id]
    
    if len(tasks) == original_len:
        raise HTTPException(status_code=404, detail="Tarea template no encontrada")
    
    await db.config_modules.update_one({"id": module_id}, {"$set": {"tasks": tasks}})
    return {"message": "Tarea template eliminada"}

# --- Admin Stats ---
@api_router.get("/admin/stats")
async def admin_get_stats(current_user: dict = Depends(require_admin)):
    users_count = await db.users.count_documents({})
    projects_count = await db.projects.count_documents({})
    tasks_count = await db.tasks.count_documents({})
    modules_count = await db.config_modules.count_documents({})
    user_types_count = await db.config_user_types.count_documents({})
    roles_count = await db.config_roles.count_documents({})
    
    return {
        "users": users_count,
        "projects": projects_count,
        "tasks": tasks_count,
        "modules": modules_count,
        "user_types": user_types_count,
        "roles": roles_count
    }

# ============= DASHBOARD STATS ENDPOINT =============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Count projects by status
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "active"})
    completed_projects = await db.projects.count_documents({"status": "completed"})
    
    # Filter: Only tasks from projects with status 'active' or 'on_hold'
    valid_projects = await db.projects.find(
        {"status": {"$in": ["active", "on_hold"]}}, 
        {"id": 1}
    ).to_list(1000)
    valid_project_ids = [p["id"] for p in valid_projects]

    # Count tasks (filtered by project status)
    total_tasks = await db.tasks.count_documents({"project_id": {"$in": valid_project_ids}})
    pending_tasks = await db.tasks.count_documents({"status": "pending", "project_id": {"$in": valid_project_ids}})
    in_progress_tasks = await db.tasks.count_documents({"status": "in_progress", "project_id": {"$in": valid_project_ids}})
    completed_tasks = await db.tasks.count_documents({"status": "completed", "project_id": {"$in": valid_project_ids}})
    
    # Get user's assigned tasks (filtered by project status)
    my_tasks = await db.tasks.count_documents({"assigned_to": current_user["id"], "project_id": {"$in": valid_project_ids}})
    my_pending_tasks = await db.tasks.count_documents({"assigned_to": current_user["id"], "status": "pending", "project_id": {"$in": valid_project_ids}})
    
    # Unread notifications
    unread_notifications = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    
    # Recent projects
    recent_projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
    # Get completed tasks with project and module names (only from active/on_hold projects)
    completed_tasks_list = await db.tasks.find({
        "status": "completed",
        "project_id": {"$in": valid_project_ids}
    }, {"_id": 0}).to_list(50)
    
    # Enrichment: Get project names and module details
    project_ids = list(set([t["project_id"] for t in completed_tasks_list]))
    projects = await db.projects.find({"id": {"$in": project_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(100)
    project_map = {p["id"]: p["name"] for p in projects}
    
    # Get config modules for names and colors
    db_modules = await get_modules_from_db()
    module_names_map = {m["id"]: m["name"] for m in db_modules}
    module_colors_map = {m["id"]: m["color"] for m in db_modules}
    
    # Group tasks: Project -> Module -> {"color": color, "tasks": [titles]}
    grouped_completed = {}
    for t in completed_tasks_list:
        p_name = project_map.get(t["project_id"], t["project_id"])
        m_id = t.get("module_id", "general")
        m_name = module_names_map.get(m_id, m_id.capitalize())
        m_color = module_colors_map.get(m_id, "slate")
        
        if p_name not in grouped_completed:
            grouped_completed[p_name] = {}
        if m_name not in grouped_completed[p_name]:
            grouped_completed[p_name][m_name] = {"color": m_color, "tasks": []}
            
        grouped_completed[p_name][m_name]["tasks"].append(t["title"])

    # --- NEW: Get pending tasks grouped --- (only from active/on_hold projects)
    pending_tasks_list = await db.tasks.find({
        "status": {"$in": ["pending", "in_progress"]},
        "project_id": {"$in": valid_project_ids}
    }, {"_id": 0}).to_list(100)
    
    # Update project_map for any pending projects not in completed
    pending_project_ids = list(set([t["project_id"] for t in pending_tasks_list if t["project_id"] not in project_map]))
    if pending_project_ids:
        pending_projects = await db.projects.find({"id": {"$in": pending_project_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(100)
        for p in pending_projects:
            project_map[p["id"]] = p["name"]

    grouped_pending = {}
    for t in pending_tasks_list:
        p_id = t["project_id"]
        p_name = project_map.get(p_id, p_id)
        m_id = t.get("module_id", "general")
        m_name = module_names_map.get(m_id, m_id.capitalize())
        m_color = module_colors_map.get(m_id, "slate")
        
        if p_name not in grouped_pending:
            grouped_pending[p_name] = {}
        if m_name not in grouped_pending[p_name]:
            grouped_pending[p_name][m_name] = {"color": m_color, "tasks": []}
            
        grouped_pending[p_name][m_name]["tasks"].append(t["title"])

    # --- NEW: Get My Tasks grouped --- (only from active/on_hold projects)
    my_tasks_list = await db.tasks.find({
        "assigned_to": current_user["id"],
        "project_id": {"$in": valid_project_ids}
    }, {"_id": 0}).to_list(100)
    
    # Update project_map for any projects in my tasks not in others
    my_project_ids = list(set([t["project_id"] for t in my_tasks_list if t["project_id"] not in project_map]))
    if my_project_ids:
        my_projects = await db.projects.find({"id": {"$in": my_project_ids}}, {"id": 1, "name": 1, "_id": 0}).to_list(100)
        for p in my_projects:
            project_map[p["id"]] = p["name"]

    grouped_my = {}
    for t in my_tasks_list:
        p_id = t["project_id"]
        p_name = project_map.get(p_id, p_id)
        m_id = t.get("module_id", "general")
        m_name = module_names_map.get(m_id, m_id.capitalize())
        m_color = module_colors_map.get(m_id, "slate")
        
        if p_name not in grouped_my:
            grouped_my[p_name] = {}
        if m_name not in grouped_my[p_name]:
            grouped_my[p_name][m_name] = {"color": m_color, "tasks": []}
            
        grouped_my[p_name][m_name]["tasks"].append(t["title"])

    return {
        "projects": {
            "total": total_projects,
            "active": active_projects,
            "completed": completed_projects
        },
        "tasks": {
            "total": total_tasks,
            "pending": pending_tasks,
            "in_progress": in_progress_tasks,
            "completed": completed_tasks
        },
        "my_tasks": {
            "total": my_tasks,
            "pending": my_pending_tasks
        },
        "unread_notifications": unread_notifications,
        "recent_projects": recent_projects,
        "completed_tasks_grouped": grouped_completed,
        "pending_tasks_grouped": grouped_pending,
        "my_tasks_grouped": grouped_my
    }

# ============= PDF EXPORT ENDPOINT =============

@api_router.get("/projects/{project_id}/export-pdf")
async def export_project_pdf(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    # Create PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=1.5*cm, 
        leftMargin=1.5*cm, 
        topMargin=1.5*cm, 
        bottomMargin=1.5*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'MainTitle', 
        parent=styles['Heading1'], 
        fontSize=22, 
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10,
        alignment=1 # Center
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle', 
        parent=styles['Normal'], 
        fontSize=12, 
        textColor=colors.HexColor('#64748b'),
        alignment=1,
        spaceAfter=30
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle', 
        parent=styles['Heading2'], 
        fontSize=16, 
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=20,
        spaceAfter=15,
        borderPadding=5,
        borderColor=colors.HexColor('#e2e8f0'),
        borderWidth=0,
        borderBottomWidth=1
    )
    
    module_header_style = ParagraphStyle(
        'ModuleHeader', 
        parent=styles['Heading3'], 
        fontSize=14, 
        textColor=colors.white,
        backColor=colors.HexColor('#4f46e5'),
        alignment=0,
        spaceBefore=15,
        spaceAfter=10,
        leftIndent=0,
        rightIndent=0,
        borderPadding=6,
    )

    label_style = ParagraphStyle(
        'Label', 
        parent=styles['Normal'], 
        fontSize=10, 
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#1e293b')
    )
    
    value_style = ParagraphStyle(
        'Value', 
        parent=styles['Normal'], 
        fontSize=10, 
        textColor=colors.HexColor('#475569')
    )

    task_title_style = ParagraphStyle(
        'TaskTitle', 
        parent=styles['Normal'], 
        fontSize=11, 
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#334155'),
        spaceBefore=8
    )

    task_desc_style = ParagraphStyle(
        'TaskDesc', 
        parent=styles['Normal'], 
        fontSize=9, 
        textColor=colors.HexColor('#64748b'),
        leftIndent=10
    )
    
    # --- CUSTOM STYLES ENHANCEMENT ---
    title_style = ParagraphStyle(
        'MainTitle', 
        parent=styles['Heading1'], 
        fontSize=28, 
        textColor=colors.white,
        spaceAfter=20,
        alignment=1
    )
    
    cover_subtitle_style = ParagraphStyle(
        'CoverSubtitle', 
        parent=styles['Normal'], 
        fontSize=16, 
        textColor=colors.HexColor('#e2e8f0'),
        alignment=1,
        spaceAfter=100
    )

    module_color_map = {
        "design": colors.HexColor("#ec4899"),
        "tech": colors.HexColor("#3b82f6"),
        "marketing": colors.HexColor("#a855f7"),
        "sales": colors.HexColor("#10b981"),
        "content": colors.HexColor("#f59e0b"),
        "admin": colors.HexColor("#64748b"),
        "academic": colors.HexColor("#06b6d4")
    }
    
    elements = []
    
    # --- COVER PAGE ---
    # Create a full-page colored block effect for the cover
    elements.append(Spacer(1, 150))
    cover_data = [[Paragraph(f"INFORME DE PROYECTO", title_style)], 
                  [Paragraph(f"{project['name']}", cover_subtitle_style)]]
    cover_table = Table(cover_data, colWidths=[18*cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#4f46e5')),
        ('TOPPADDING', (0, 0), (-1, -1), 40),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 40),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [15, 15, 15, 15]),
    ]))
    elements.append(cover_table)
    
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"<b>Para:</b> {project['client_name']}", subtitle_style))
    elements.append(Paragraph(f"<b>Generado el:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", subtitle_style))
    elements.append(PageBreak())
    
    # --- PROGRESS VISUALIZER ---
    elements.append(Paragraph("Estado de Ejecución", section_title_style))
    
    progress = project.get("progress", 0)
    # Visual Progress Bar
    bar_width = 17*cm
    progress_bar_data = [[
        Table([[""]], colWidths=[(bar_width * (progress/100.0)) or 1], rowHeights=[0.5*cm],
              style=[('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#10b981'))])
    ]]
    progress_bar_table = Table(progress_bar_data, colWidths=[bar_width], rowHeights=[0.5*cm])
    progress_bar_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"<b>Progreso General: {progress}%</b>", value_style))
    elements.append(progress_bar_table)
    elements.append(Spacer(1, 10))

    # --- GENERAL INFORMATION ---
    elements.append(Paragraph("Información General", section_title_style))
    # ... (rest of general info logic as before but more spaced)
    gen_data = [
        [Paragraph("Cliente:", label_style), Paragraph(project["client_name"], value_style)],
        [Paragraph("Estado:", label_style), Paragraph(project["status"].replace("_", " ").capitalize(), value_style)],
        [Paragraph("Cronograma:", label_style), Paragraph(f"Desde {project['start_date']} hasta {project['end_date']}", value_style)],
    ]
    if project.get("description"):
        gen_data.append([Paragraph("Descripción:", label_style), Paragraph(project["description"], value_style)])
    
    gen_table = Table(gen_data, colWidths=[4*cm, 13*cm])
    gen_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
    elements.append(gen_table)
    
    # --- FINANCIAL INFORMATION ---
    elements.append(Paragraph("Información Financiera", section_title_style))
    currency_formatter = lambda val: f"{val:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")
    
    def colored_badge(text, color):
        return Table([[Paragraph(text, ParagraphStyle('Badge', parent=value_style, textColor=colors.white, alignment=1))]],
                    style=[('BACKGROUND', (0, 0), (-1, -1), color), ('ROUNDEDCORNERS', [8, 8, 8, 8])])

    fin_data = [
        [Paragraph("Presupuesto Total:", label_style), Paragraph(currency_formatter(project.get("total_project_cost", 0)), 
                                                               ParagraphStyle('BoldVal', parent=value_style, fontSize=14, fontName='Helvetica-Bold', textColor=colors.HexColor('#4f46e5')))],
        [Paragraph("Matrícula:", label_style), Paragraph(currency_formatter(project.get("enrollment_payment", 0)), value_style)],
        [Paragraph("Facturación:", label_style), Paragraph(f"Modalidad {'Variable' if project.get('billing_mode') == 'module' else 'Fija'}", value_style)],
    ]
    fin_table = Table(fin_data, colWidths=[4*cm, 13*cm])
    fin_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BOTTOMPADDING', (0, 0), (-1, -1), 12)]))
    elements.append(fin_table)
    
    # --- MODULES & TASKS ---
    elements.append(Paragraph("Desglose de Módulos", section_title_style))
    
    db_modules = await get_modules_from_db()
    modules_metadata = {m["id"]: m["name"] for m in db_modules}
    ordered_ids = [m["id"] for m in db_modules]
    
    # Sort project modules to follow admin order
    project_sorted_modules = [m for m in project.get("modules", [])]
    project_sorted_modules.sort(key=lambda x: ordered_ids.index(x) if x in ordered_ids else 999)

    for module_id in project_sorted_modules:
        module_name = modules_metadata.get(module_id, module_id.capitalize())
        mod_color = module_color_map.get(module_id, colors.HexColor("#4f46e5"))
        
        # Professional Module Header
        mod_header_data = [[Paragraph(module_name.upper(), ParagraphStyle('MTitle', parent=module_header_style, backColor=None))]]
        if project.get("billing_mode") == "module":
            cost = project.get("module_costs", {}).get(module_id, 0)
            mod_header_data[0].append(Paragraph(f"Presupuesto: {currency_formatter(cost)}", 
                                              ParagraphStyle('MCost', parent=module_header_style, backColor=None, alignment=2)))
        
        mod_header_table = Table(mod_header_data, colWidths=[9*cm, 8*cm])
        mod_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), mod_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(mod_header_table)
        
        module_tasks = [t for t in tasks if t["module_id"] == module_id]
        if not module_tasks:
            elements.append(Paragraph("Sin tareas asignadas.", value_style))
        else:
            for task in module_tasks:
                status_color = "#94a3b8" if task["status"] == "pending" else "#6366f1" if task["status"] == "in_progress" else "#10b981"
                # Task Title with colored bullet
                elements.append(Paragraph(f'<font color="{status_color}">■</font> <b>{task["title"]}</b>', task_title_style))
                
                if task.get("description"):
                    elements.append(Paragraph(task["description"], task_desc_style))
                
                # Checkbox items
                for item in task.get("checklist", []):
                    symbol = "<b>√</b>" if item.get("completed") else "○"
                    elements.append(Paragraph(f"{symbol} {item.get('text', '')}", 
                                           ParagraphStyle('Check', parent=styles['Normal'], fontSize=8.5, leftIndent=25, textColor=colors.HexColor('#475569'))))
                
                # Inline Deliverables indicator
                d_count = sum(1 for d in task.get("deliverables", []) if d.get("file_url"))
                if d_count > 0:
                    elements.append(Paragraph(f"<i>(Vea Anexo: {d_count} archivos subidos)</i>", 
                                           ParagraphStyle('DelivSmall', parent=styles['Normal'], fontSize=8, leftIndent=25, italic=True, textColor=colors.HexColor('#6366f1'))))
                
                elements.append(Spacer(1, 8))
        
        elements.append(Spacer(1, 15))

    # --- GLOBAL DELIVERABLES REPOSITORY ---
    elements.append(PageBreak())
    elements.append(Paragraph("Repositorio General de Entregables", section_title_style))
    
    deliverables_with_files = []
    for module_id in project.get("modules", []):
        mod_tasks = [t for t in tasks if t["module_id"] == module_id]
        for task in mod_tasks:
            for d in task.get("deliverables", []):
                if d.get("file_url"):
                    d['parent_module_name'] = modules_metadata.get(module_id, module_id)
                    d['parent_task_title'] = task['title']
                    d['module_color'] = module_color_map.get(module_id, colors.HexColor("#4f46e5"))
                    deliverables_with_files.append(d)
            
    if deliverables_with_files:
        deliv_table_data = [[Paragraph("Módulo", label_style), Paragraph("Tarea", label_style), 
                             Paragraph("Entregable (Click para ver)", label_style), Paragraph("Estado", label_style)]]
        
        link_style = ParagraphStyle('RepoLink', parent=value_style, textColor=colors.HexColor('#4f46e5'), fontName='Helvetica-Bold')

        for d in deliverables_with_files:
            # RESTORED: Anchor link to the specific page in the sequential annex
            deliv_link = f'<a href="#deliv_{d["id"]}">{d["name"]}</a>'
            
            deliv_table_data.append([
                Paragraph(d['parent_module_name'], value_style),
                Paragraph(d['parent_task_title'], value_style),
                Paragraph(deliv_link, link_style),
                d.get("status", "pending").capitalize()
            ])
            
        deliv_table = Table(deliv_table_data, colWidths=[3*cm, 5*cm, 6*cm, 3*cm])
        deliv_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(deliv_table)
    else:
        elements.append(Paragraph("No hay entregables registrados.", value_style))

    # Build the main report first
    doc.build(elements)
    
    # Initialize the final merged PDF
    final_output = BytesIO()
    writer = PdfWriter()
    
    # Add the main report pages
    main_report_reader = PdfReader(BytesIO(buffer.getvalue()))
    for page in main_report_reader.pages:
        writer.add_page(page)

    # Add a global bookmark for the report
    writer.add_outline_item("Resumen Ejecutivo", 0)

    # --- SEQUENTIAL ANNEX ASSEMBLY ---
    if deliverables_with_files:
        current_module_bookmark = None
        last_module_id = None
        
        for d in deliverables_with_files:
            file_name = d["file_url"].split("/")[-1]
            file_path = UPLOADS_DIR / file_name
            
            if not file_path.exists():
                continue

            # Add Module Bookmarks to the sidebar for better navigation
            if d.get('module_id') != last_module_id:
                current_module_bookmark = writer.add_outline_item(d['parent_module_name'], 0)
                last_module_id = d.get('module_id')

            # Page counter to link from sidebar
            page_start_index = len(writer.pages)
            writer.add_outline_item(d['name'], 1, parent=current_module_bookmark)

            # 1. Generate a "Header/Detail" page with Anchor
            header_buffer = BytesIO()
            header_doc = SimpleDocTemplate(header_buffer, pagesize=A4, margin=1.5*cm)
            header_elements = [
                Spacer(1, 20),
                # RESTORED: Anchor name for internal linking
                Paragraph(f'<a name="deliv_{d["id"]}"/><b>ENTREGABLE: {d["name"]}</b>', 
                         ParagraphStyle('FileTitle', parent=label_style, fontSize=18, textColor=d['module_color'], spaceAfter=10)),
                Paragraph(f"Módulo: {d['parent_module_name']}", value_style),
                Paragraph(f"Tarea: {d['parent_task_title']}", value_style),
                Paragraph(f"Estado de Revisión: {d.get('status', 'pending').capitalize()}", value_style),
                Spacer(1, 20)
            ]

            ext = file_path.suffix.lower()
            
            if ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']:
                try:
                    img = RLImage(str(file_path))
                    aspect = img.imageHeight / float(img.imageWidth)
                    max_w, max_h = 17*cm, 18*cm
                    if img.imageWidth > max_w: img.drawWidth = max_w; img.drawHeight = max_w * aspect
                    if img.drawHeight > max_h: img.drawHeight = max_h; img.drawWidth = max_h / aspect
                    header_elements.append(img)
                except Exception:
                    header_elements.append(Paragraph("[Error cargando imagen]", value_style))
                
                header_doc.build(header_elements)
                reader = PdfReader(BytesIO(header_buffer.getvalue()))
                for page in reader.pages: writer.add_page(page)

            elif ext == '.pdf':
                header_elements.append(Paragraph("<i>(El contenido original del documento PDF comienza en la página siguiente)</i>", value_style))
                header_doc.build(header_elements)
                
                h_reader = PdfReader(BytesIO(header_buffer.getvalue()))
                for page in h_reader.pages: writer.add_page(page)
                
                try:
                    src_reader = PdfReader(str(file_path))
                    for page in src_reader.pages: writer.add_page(page)
                except Exception as e:
                    logger.error(f"Error merging sequential PDF: {e}")

    # Add Bookmark for the end of the document
    writer.write(final_output)
    final_output.seek(0)
    
    return StreamingResponse(
        final_output, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=Dossier_{project['name'].replace(' ','_')}.pdf"}
    )

# ============= ROOT ENDPOINT =============

@api_router.get("/")
async def root():
    return {"message": "eLearning 360 Project Manager API"}

# Include the router in the main app
app.include_router(api_router)



@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

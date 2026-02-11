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

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    client_name: str
    start_date: str
    end_date: str
    modules: List[str]
    status: str = "active"  # active, completed, on_hold, cancelled
    description: str = ""
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    progress: float = 0.0

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

async def send_email_notification(to_email: str, subject: str, html_content: str):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return
    
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

def generate_tasks_for_modules(project_id: str, modules: List[str], end_date: str) -> List[dict]:
    tasks = []
    for module_id in modules:
        if module_id in MODULE_TEMPLATES:
            template = MODULE_TEMPLATES[module_id]
            for task_template in template["tasks"]:
                # Create deliverables with full structure
                deliverables = []
                for item in task_template["deliverables"]:
                    deliverables.append({
                        "id": str(uuid.uuid4()),
                        "name": item["name"],
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
                
                task = Task(
                    project_id=project_id,
                    module_id=module_id,
                    title=task_template["title"],
                    description=task_template["description"],
                    checklist=[{**item, "id": str(uuid.uuid4())} for item in task_template["checklist"]],
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
    
    # Calculate progress for each project
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
    
    # Group tasks by module
    modules_data = {}
    for module_id in project["modules"]:
        if module_id in MODULE_TEMPLATES:
            module_tasks = [t for t in tasks if t["module_id"] == module_id]
            modules_data[module_id] = {
                "id": module_id,
                "name": MODULE_TEMPLATES[module_id]["name"],
                "tasks": module_tasks,
                "total": len(module_tasks),
                "completed": sum(1 for t in module_tasks if t["status"] == "completed")
            }
    
    project["modules_data"] = modules_data
    
    return project

@api_router.post("/projects")
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(require_manager_or_admin)):
    project = Project(
        name=project_data.name,
        client_name=project_data.client_name,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        modules=project_data.modules,
        description=project_data.description or "",
        created_by=current_user["id"]
    )
    
    doc = project.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.projects.insert_one(doc)
    
    # Generate tasks for selected modules
    tasks = generate_tasks_for_modules(project.id, project_data.modules, project_data.end_date)
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
    
    # Remove MongoDB _id field for JSON serialization
    doc.pop('_id', None)
    
    return {
        "message": "Proyecto creado exitosamente",
        "project": doc,
        "tasks_created": len(tasks)
    }

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, project_update: ProjectUpdate, current_user: dict = Depends(require_manager_or_admin)):
    update_data = {k: v for k, v in project_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    result = await db.projects.update_one({"id": project_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
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
    
    # If task was assigned, notify the user
    if "assigned_to" in update_data and update_data["assigned_to"]:
        assigned_user = await db.users.find_one({"id": update_data["assigned_to"]}, {"_id": 0})
        if assigned_user:
            await create_notification(
                user_id=update_data["assigned_to"],
                type="task_assigned",
                title="Tarea Asignada",
                message=f"Se te ha asignado la tarea '{original_task['title']}'",
                project_id=original_task["project_id"]
            )
            # Send email notification
            await send_email_notification(
                assigned_user["email"],
                "Nueva tarea asignada - eLearning 360",
                f"""
                <h2>Se te ha asignado una nueva tarea</h2>
                <p><strong>Tarea:</strong> {original_task['title']}</p>
                <p><strong>Descripción:</strong> {original_task.get('description', 'Sin descripción')}</p>
                <p>Accede a la plataforma para ver más detalles.</p>
                """
            )
    
    return {"message": "Tarea actualizada"}

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
    modules = []
    for key, value in MODULE_TEMPLATES.items():
        modules.append({
            "id": key,
            "name": value["name"],
            "tasks_count": len(value["tasks"])
        })
    return modules

@api_router.get("/user-types")
async def get_user_types():
    """Get all available user types for task assignment"""
    return USER_TYPES

# ============= DASHBOARD STATS ENDPOINT =============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Count projects by status
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "active"})
    completed_projects = await db.projects.count_documents({"status": "completed"})
    
    # Count tasks
    total_tasks = await db.tasks.count_documents({})
    pending_tasks = await db.tasks.count_documents({"status": "pending"})
    in_progress_tasks = await db.tasks.count_documents({"status": "in_progress"})
    completed_tasks = await db.tasks.count_documents({"status": "completed"})
    
    # Get user's assigned tasks
    my_tasks = await db.tasks.count_documents({"assigned_to": current_user["id"]})
    my_pending_tasks = await db.tasks.count_documents({"assigned_to": current_user["id"], "status": "pending"})
    
    # Unread notifications
    unread_notifications = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    
    # Recent projects
    recent_projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
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
        "recent_projects": recent_projects
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
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15)
    normal_style = styles['Normal']
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"Informe del Proyecto: {project['name']}", title_style))
    elements.append(Spacer(1, 10))
    
    # Project info
    info_data = [
        ["Cliente:", project["client_name"]],
        ["Fecha de inicio:", project["start_date"]],
        ["Fecha de fin:", project["end_date"]],
        ["Estado:", project["status"].capitalize()],
    ]
    
    info_table = Table(info_data, colWidths=[4*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Tasks by module
    for module_id in project["modules"]:
        if module_id in MODULE_TEMPLATES:
            module_name = MODULE_TEMPLATES[module_id]["name"]
            module_tasks = [t for t in tasks if t["module_id"] == module_id]
            
            elements.append(Paragraph(module_name, heading_style))
            
            if module_tasks:
                task_data = [["Tarea", "Estado", "Progreso"]]
                for task in module_tasks:
                    # Calculate checklist progress
                    checklist = task.get("checklist", [])
                    if checklist:
                        completed = sum(1 for item in checklist if item.get("completed", False))
                        progress = f"{completed}/{len(checklist)}"
                    else:
                        progress = "-"
                    
                    status_map = {"pending": "Pendiente", "in_progress": "En progreso", "completed": "Completada"}
                    task_data.append([
                        task["title"][:40] + ("..." if len(task["title"]) > 40 else ""),
                        status_map.get(task["status"], task["status"]),
                        progress
                    ])
                
                task_table = Table(task_data, colWidths=[8*cm, 4*cm, 3*cm])
                task_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ]))
                elements.append(task_table)
            else:
                elements.append(Paragraph("No hay tareas en este módulo.", normal_style))
            
            elements.append(Spacer(1, 10))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=proyecto_{project_id}.pdf"}
    )

# ============= ROOT ENDPOINT =============

@api_router.get("/")
async def root():
    return {"message": "eLearning 360 Project Manager API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

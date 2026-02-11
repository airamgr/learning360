# eLearning 360 Project Manager - PRD

## Descripción Original
Herramienta para gestionar proyectos eLearning 360 como un modelo. Los proyectos se dividen en 7 módulos que los clientes pueden contratar, y cuando se crea un proyecto se generan automáticamente tareas, checklists y entregables.

## Arquitectura

### Backend (FastAPI + MongoDB)
- **Autenticación**: JWT con roles (admin, project_manager, collaborator)
- **Base de datos**: MongoDB
- **Almacenamiento de archivos**: /app/backend/uploads/
- **Endpoints principales**:
  - `/api/auth/*` - Registro, login, usuario actual
  - `/api/projects/*` - CRUD proyectos
  - `/api/tasks/*` - Gestión de tareas
  - `/api/tasks/{id}/deliverables/*` - Repositorio de entregables (NUEVO)
  - `/api/users/*` - Gestión de usuarios (admin)
  - `/api/notifications/*` - Notificaciones
  - `/api/modules` - Templates de módulos

### Frontend (React + Tailwind + Shadcn)
- **Páginas**: Login, Register, Dashboard, Projects, ProjectDetail, NewProject, Users, Profile
- **Componentes**: DeliverableRepository (NUEVO)
- **Diseño**: Moderno/minimalista con paleta Soft Utility (Slate-900, Indigo-500)

## Módulos del Sistema
1. Diseño de Marca e Identidad Visual
2. Tecnología y Desarrollo
3. Comunicación y Marketing
4. Atención Comercial
5. Factoría de Contenidos y Cursos
6. Gestión Administrativa y Financiera
7. Gestión Académica

## Lo Implementado (Feb 2026)
- ✅ Sistema de autenticación con roles
- ✅ Dashboard con estadísticas
- ✅ CRUD de proyectos
- ✅ Generación automática de tareas por módulo
- ✅ Gestión de checklists
- ✅ **Repositorio de Entregables (NUEVO)**:
  - Subida de archivos físicos por entregable
  - Estados: pendiente, en_revisión, aprobado, rechazado
  - Sistema de feedback y revisión
  - Tracking de reviewer y fechas
  - Descarga de archivos
- ✅ Exportación a PDF
- ✅ Sistema de notificaciones in-app
- ✅ Gestión de usuarios (admin)
- ✅ Control de acceso basado en roles

## Integraciones
- **Email (Resend)**: Configurado pero requiere API key para envío real
- **PDF (ReportLab)**: Funcional
- **File Storage**: Local uploads directory

## Backlog (P0/P1/P2)

### P0 - Crítico
- Todos los features core implementados ✅

### P1 - Importante
- Configurar Resend API key para notificaciones email
- Asignación de tareas a usuarios específicos
- Filtros avanzados por módulo en lista de tareas
- Vista de calendario visual de entregas

### P2 - Deseable
- Comentarios en tareas
- Versionado de archivos en entregables
- Dashboard de reporting por cliente
- Plantillas de proyecto personalizables
- Exportación a Excel
- Storage cloud (S3) para archivos

## Usuarios/Personas
1. **Admin**: Control total, gestión de usuarios, revisión de entregables
2. **Project Manager**: Crear/editar proyectos, revisar entregables, gestionar tareas
3. **Colaborador**: Ver proyectos, subir entregables, actualizar tareas asignadas

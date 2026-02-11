# eLearning 360 Project Manager - PRD

## Descripción Original
Herramienta para gestionar proyectos eLearning 360 como un modelo. Los proyectos se dividen en 7 módulos que los clientes pueden contratar, y cuando se crea un proyecto se generan automáticamente tareas, checklists y entregables.

## Arquitectura

### Backend (FastAPI + MongoDB)
- **Autenticación**: JWT con roles (admin, project_manager, collaborator)
- **Base de datos**: MongoDB
- **Endpoints principales**:
  - `/api/auth/*` - Registro, login, usuario actual
  - `/api/projects/*` - CRUD proyectos
  - `/api/tasks/*` - Gestión de tareas
  - `/api/users/*` - Gestión de usuarios (admin)
  - `/api/notifications/*` - Notificaciones
  - `/api/modules` - Templates de módulos

### Frontend (React + Tailwind + Shadcn)
- **Páginas**: Login, Register, Dashboard, Projects, ProjectDetail, NewProject, Users, Profile
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
- ✅ Gestión de checklists y entregables
- ✅ Exportación a PDF
- ✅ Sistema de notificaciones in-app
- ✅ Gestión de usuarios (admin)
- ✅ Control de acceso basado en roles

## Integraciones
- **Email (Resend)**: Configurado pero requiere API key para envío real
- **PDF (ReportLab)**: Funcional

## Backlog (P0/P1/P2)

### P0 - Crítico
- Todos los features core implementados ✅

### P1 - Importante
- Configurar Resend API key para notificaciones email
- Asignación de tareas a usuarios específicos
- Filtros avanzados por módulo en lista de tareas
- Calendario visual de fechas límite

### P2 - Deseable
- Comentarios en tareas
- Adjuntos en entregables
- Dashboard de reporting por cliente
- Plantillas de proyecto personalizables
- Exportación a Excel

## Usuarios/Personas
1. **Admin**: Control total, gestión de usuarios
2. **Project Manager**: Crear/editar proyectos, gestionar tareas
3. **Colaborador**: Ver proyectos, actualizar tareas asignadas

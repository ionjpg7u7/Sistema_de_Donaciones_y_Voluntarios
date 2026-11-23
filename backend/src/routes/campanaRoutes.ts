// src/routes/campanaRoutes.ts
// ============================================================================
// RUTAS: Módulo de Gestión de Campañas y Actividades
// ============================================================================
import { Router } from 'express';
import { campanaController as c } from '../controllers/campanaController';
import { verificarToken, esAdmin, esCoordinadorOAdmin } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/asyncHandler';

const router = Router();

// --- 1. RUTAS PÚBLICAS (Para landing page, no requieren token) ---
router.get('/publicas', asyncHandler(c.listarPublicas));
router.get('/publicas/actividades', asyncHandler(c.listarActividadesPublicas));
router.get('/publicas/:id(\\d+)', asyncHandler(c.obtenerPorId));

// --- 2. RUTAS PROTEGIDAS (Requieren autenticación) ---
router.use(verificarToken);

// Participación personal del usuario autenticado (Donante, Voluntario, Usuario, etc.)
router.get('/mis-actividades', asyncHandler(c.misActividades));
router.post('/actividades/:id(\\d+)/inscribirse', asyncHandler(c.inscribirse));
router.post('/actividades/:id(\\d+)/desinscribirse', asyncHandler(c.desinscribirse));

// Consulta general autenticada
router.get('/actividades', asyncHandler(c.listarActividades));
router.get('/actividades/:id(\\d+)', asyncHandler(c.obtenerActividadPorId));
router.get('/:id(\\d+)', asyncHandler(c.obtenerPorId));
router.get('/', asyncHandler(c.listar));

// Gestión de Asistencia y Voluntarios por Actividad (Admin o Coordinador)
router.get('/actividades/:id(\\d+)/voluntarios', esCoordinadorOAdmin, asyncHandler(c.listarVoluntariosActividad));
router.post('/actividades/participaciones/:idParticipacion(\\d+)/asistencia', esCoordinadorOAdmin, asyncHandler(c.registrarAsistencia));

// CRUD de Campañas y Actividades (Solo Administrador)
router.post('/', esAdmin, asyncHandler(c.crear));
router.put('/:id(\\d+)', esAdmin, asyncHandler(c.actualizar));
router.delete('/:id(\\d+)', esAdmin, asyncHandler(c.eliminar));

router.post('/actividades', esAdmin, asyncHandler(c.crearActividad));
router.put('/actividades/:id(\\d+)', esAdmin, asyncHandler(c.actualizarActividad));
router.delete('/actividades/:id(\\d+)', esAdmin, asyncHandler(c.eliminarActividad));

export default router;

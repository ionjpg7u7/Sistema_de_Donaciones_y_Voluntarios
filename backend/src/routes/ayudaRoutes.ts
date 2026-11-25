// src/routes/ayudaRoutes.ts
// ============================================================================
// Rutas /api/ayudas. Todo el módulo exige JWT.
// Las rutas literales no compiten con /:id porque los identificadores solo
// aparecen después de /solicitudes.
// ============================================================================
import { Router } from 'express';
import { verificarToken } from '../middlewares/authMiddleware';
import { requerirRolAyuda } from '../middlewares/ayudaAccess';
import { asyncHandler } from '../middlewares/asyncHandler';
import { ayudaController } from '../controllers/ayudaController';

const router = Router();

router.use(verificarToken);

// Directorio de beneficiarios verificados (solo administración).
router.get(
  '/beneficiarios',
  requerirRolAyuda('Administrador'),
  asyncHandler(ayudaController.listarBeneficiarios)
);

// Bandeja / historial de solicitudes.
router.get(
  '/solicitudes',
  requerirRolAyuda('Administrador', 'Beneficiario'),
  asyncHandler(ayudaController.listarSolicitudes)
);
router.get(
  '/solicitudes/:id(\\d+)',
  requerirRolAyuda('Administrador', 'Beneficiario'),
  asyncHandler(ayudaController.obtenerSolicitud)
);
router.post(
  '/solicitudes',
  requerirRolAyuda('Administrador', 'Beneficiario'),
  asyncHandler(ayudaController.crearSolicitud)
);

// Evaluación y cierre (solo administración).
router.patch(
  '/solicitudes/:id(\\d+)/revision',
  requerirRolAyuda('Administrador'),
  asyncHandler(ayudaController.revisarSolicitud)
);
router.get(
  '/solicitudes/:id(\\d+)/asignaciones',
  requerirRolAyuda('Administrador', 'Beneficiario'),
  asyncHandler(ayudaController.oportunidadesAsignaciones)
);
router.patch(
  '/solicitudes/:id(\\d+)/asignaciones',
  requerirRolAyuda('Administrador'),
  asyncHandler(ayudaController.asignarDonacion)
);
router.patch(
  '/solicitudes/:id(\\d+)/cierre',
  requerirRolAyuda('Administrador'),
  asyncHandler(ayudaController.cerrarSolicitud)
);
router.patch(
  '/solicitudes/:id(\\d+)/evaluacion',
  requerirRolAyuda('Administrador'),
  asyncHandler(ayudaController.iniciarEvaluacion)
);
router.patch(
  '/solicitudes/:id(\\d+)/cancelar-solicitante',
  requerirRolAyuda('Administrador', 'Beneficiario'),
  asyncHandler(ayudaController.cancelarSolicitante)
);

export default router;

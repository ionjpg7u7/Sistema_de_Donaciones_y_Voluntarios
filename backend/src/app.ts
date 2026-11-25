/**
 * ============================================================================
 * ARCHIVO: app.ts
 * CAPA: Configuración de la Aplicación Express
 *
 * PROPÓSITO:
 * Centraliza la configuración de Express y el registro de todas las rutas
 * del sistema de donaciones y voluntariado.
 *
 * NOTA ARQUITECTURA MULTICAPA:
 * El manejo de errores y el 404 se delegan a middlewares dedicados
 * (errorMiddleware / notFoundMiddleware) para mantener la capa de
 * presentación limpia y centralizada.
 * ============================================================================
 */

import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';

// ============================================================================
// IMPORTACIÓN DE RUTAS
// ============================================================================

// Gestión de usuarios y autenticación
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import donacionRoutes from './routes/donacionRoutes';
import campanaRoutes from './routes/campanaRoutes';
import disponibilidadRoutes from './routes/disponibilidadRoutes';
import ayudaRoutes from './routes/ayudaRoutes';

// ============================================================================
// IMPORTACIÓN DE MIDDLEWARES GLOBALES
// ============================================================================

import { errorMiddleware, notFoundMiddleware } from './middlewares/errorMiddleware';

// ============================================================================
// INICIALIZACIÓN DE EXPRESS
// ============================================================================

export const app: Application = express();

app.disable('x-powered-by');

// ============================================================================
// MIDDLEWARES GLOBALES
// ============================================================================

// CORS
// Se utiliza la variable de entorno FRONTEND_URL para permitir solo peticiones 
// desde tu frontend. Si no está definida, usa localhost:5173 por defecto.
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Permite recibir JSON
app.use(express.json());

// Archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logger simple
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`📡 [${req.method}] ${req.url} - ${new Date().toLocaleTimeString()}`);
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend de Donaciones y Voluntariado funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// Autenticación
app.use('/api/auth', authRoutes);

// Gestión de usuarios
app.use('/api/usuarios', userRoutes);

// Gestión de donaciones: módulo aislado, reutiliza la autenticación existente.
app.use('/api/donaciones', donacionRoutes);

// Gestión de campañas y actividades (Sprint 3)
app.use('/api/campanas', campanaRoutes);

// Gestión de voluntarios: sección "Mi Disponibilidad" (Iteración 4)
app.use('/api/voluntarios', disponibilidadRoutes);

// Gestión de beneficiarios y solicitudes de ayuda.
app.use('/api/ayudas', ayudaRoutes);

// ============================================================================
// RUTA PRINCIPAL
// ============================================================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'API del sistema de donaciones y voluntariado funcionando correctamente',
  });
});

// ============================================================================
// RUTA 404 (middleware dedicado)
// ============================================================================

app.use(notFoundMiddleware);

// ============================================================================
// MANEJO GLOBAL DE ERRORES (middleware dedicado)
// ============================================================================

app.use(errorMiddleware);

export default app;
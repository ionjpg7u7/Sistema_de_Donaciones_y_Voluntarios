/**
 * ============================================================================
 * ARCHIVO: server.ts
 * CAPA: Punto de Entrada (Entry Point)
 *
 * PROPÓSITO:
 * Inicializa el servidor HTTP, verifica la conexión con PostgreSQL antes de
 * comenzar a recibir peticiones y gestiona el cierre ordenado (graceful shutdown).
 *
 * NOTA ARQUITECTURA MULTICAPA:
 * Este archivo es el ÚNICO que llama a app.listen(). app.ts solo configura
 * Express y exporta la aplicación para permitir testeo con Supertest y
 * despliegue serverless.
 * ============================================================================
 */

import dotenv from 'dotenv';
import type { Server } from 'http';

import app from './app';
import { testDatabaseConnection, pool } from './config/database';
import { sincronizarSecuencias } from './utils/syncSecuencias';

// ============================================================================
// VARIABLES DE ENTORNO
// ============================================================================

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// ARRANQUE DEL SERVIDOR
// ============================================================================

const startServer = async (): Promise<void> => {
  try {
    // 1. Verificar conexión con PostgreSQL
    console.log('🔄 Verificando conexión con PostgreSQL...');

    const conectado = await testDatabaseConnection();

    // En producción, si la BD no responde al arranque, se aborta.
    // En desarrollo se permite arrancar igual para no bloquear el flujo
    // de trabajo mientras se levanta Docker/la BD.
    if (!conectado && NODE_ENV === 'production') {
      console.error('❌ No se pudo conectar a la base de datos. Abortando arranque.');
      process.exit(1);
    }

    if (!conectado) {
      console.warn('⚠️  El servidor arrancará SIN conexión a la BD (modo desarrollo).');
    } else {
      // Sincronizar secuencias para prevenir errores de inserción por seeds con IDs manuales
      await sincronizarSecuencias();
    }

    // 2. Iniciar servidor HTTP
    const server: Server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 Servidor backend escuchando en: http://localhost:${PORT}`);
      console.log(`🌱 Entorno: ${NODE_ENV}`);
      console.log(`🔐 Autenticación: http://localhost:${PORT}/api/auth`);
      console.log(`👤 Usuarios:      http://localhost:${PORT}/api/usuarios`);
      console.log(`🩺 Health check:  http://localhost:${PORT}/api/health`);
      console.log('====================================================');
    });

    // 3. Manejo de cierre ordenado (graceful shutdown)
    const cerrarServidor = (senal: string) => {
      console.log(`\n🛑 Recibida señal ${senal}. Cerrando servidor...`);

      server.close(async () => {
        console.log('✅ Servidor HTTP cerrado.');

        try {
          await pool.end();
          console.log('✅ Pool de PostgreSQL cerrado.');
        } catch (err) {
          console.error('⚠️  Error cerrando el pool de PostgreSQL:', err);
        }

        process.exit(0);
      });

      // Forzar salida si algo se cuelga
      setTimeout(() => {
        console.error('⏱️  Cierre forzado por timeout.');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGINT', () => cerrarServidor('SIGINT'));
    process.on('SIGTERM', () => cerrarServidor('SIGTERM'));

    // 4. Captura de errores no controlados a nivel de proceso
    process.on('unhandledRejection', (motivo) => {
      console.error('💥 Promesa rechazada sin manejar:', motivo);
    });

    process.on('uncaughtException', (err) => {
      console.error('💥 Excepción no capturada:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
};

void startServer();
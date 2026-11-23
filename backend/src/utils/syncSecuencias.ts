import { pool } from '../config/database';

/**
 * Sincroniza todas las secuencias de PostgreSQL con los valores máximos actuales
 * de las tablas. Evita errores de clave duplicada (código 23505) producidos por
 * inserciones manuales con IDs explícitos en scripts de semilla (02_inserts.sql).
 */
export const sincronizarSecuencias = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    try {
      // 1. Sincronizar todas las secuencias vinculadas a tablas (SERIAL / IDENTITY)
      const queryOwned = `
        DO $$
        DECLARE
          r RECORD;
          max_val BIGINT;
        BEGIN
          FOR r IN (
            SELECT
              t.relname AS table_name,
              a.attname AS column_name,
              s.relname AS sequence_name
            FROM pg_class s
            JOIN pg_depend d ON d.objid = s.oid
            JOIN pg_class t ON d.refobjid = t.oid
            JOIN pg_attribute a ON (d.refobjid = a.attrelid AND d.refobjsubid = a.attnum)
            WHERE s.relkind = 'S' AND d.deptype = 'a'
          ) LOOP
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.column_name, r.table_name) INTO max_val;
            IF max_val > 0 THEN
              EXECUTE format('SELECT setval(%L, GREATEST((SELECT last_value FROM %I), %s))', r.sequence_name, r.sequence_name, max_val);
            END IF;
          END LOOP;
        END $$;
      `;
      await client.query(queryOwned);

      // 2. Sincronizar secuencias independientes para numeración de donación y comprobante
      await client.query(`
        SELECT setval('donacion_codigo_seq', GREATEST((SELECT last_value FROM donacion_codigo_seq), COALESCE((SELECT MAX(id_donacion) FROM donacion), 1) + 10));
        SELECT setval('comprobante_donacion_seq', GREATEST((SELECT last_value FROM comprobante_donacion_seq), COALESCE((SELECT MAX(id_comprobante) FROM comprobante_donacion), 1) + 10));
      `);
      console.log('✅ [PostgreSQL] Secuencias de base de datos sincronizadas correctamente.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('⚠️  [PostgreSQL] Advertencia al sincronizar secuencias:', err.message);
  }
};

# AGENTS.md

## Layout and verification

- `backend/` and `frontend/` are independent npm projects; the root `package-lock.json` is empty and there are no root scripts. Run install/build/typecheck inside each directory (both have committed lockfiles; Docker uses `npm ci`).
- Backend entry: `backend/src/server.ts` (the only `app.listen()`); `backend/src/app.ts` mounts `/api/auth`, `/api/usuarios`, `/api/donaciones`, `/api/campanas`, `/api/ayudas`. Frontend entry: `frontend/src/main.tsx` → `frontend/src/App.tsx`; private routes include `/donaciones`, `/campanas`, `/ayudas`, `/perfil`, `/usuarios`.
- No tests, linter, formatter, CI, or Swagger. Verification is `npx tsc --noEmit` and `npm run build` in each directory. Frontend `tsc` also has `noUnusedLocals`/`noUnusedParameters`; backend is strict CommonJS and `npm run build` emits `dist/`.

## Local setup and database

- Root `.env` must exist before Compose. The backend loads it even locally and maps `DB_HOST=db` → `localhost` outside Docker (`backend/src/config/database.ts`); CORS allows only `FRONTEND_URL` (default `http://localhost:5173`).
- Preferred dev loop: `docker compose up -d db`, then `npm run dev` in `backend/` (nodemon + ts-node) and `frontend/` (Vite :5173). The shared Axios client falls back to `http://localhost:4000/api`; Vite proxies only `/api`. `SolicitarRecuperacion.tsx` and `ResetPassword.tsx` use `VITE_API_URL` directly, so recovery flows need `frontend/.env` outside the default setup.
- Current `compose.yaml` publishes no host port for the DB; use `docker exec` for psql. `database/*.sql` runs only on an empty `pgdata` volume: do not re-run `01_schema.sql`/`02_inserts.sql` on an existing volume. Add new scripts as `database/03_*.sql`; `docker compose down -v` deletes all data.
- Seed login is `carla.admin@donacionesbo.org` / `Passw123`; the `123456` comment in `02_inserts.sql` is wrong.
- Startup calls `utils/syncSecuencias.ts` after the DB check because seeds insert explicit IDs. After similar manual inserts, restart the backend instead of editing sequences by hand.

## Backend conventions

- Dependency direction is `routes → middlewares → controllers → services → repositories`. SQL lives only in repositories with `$1` placeholders, services must not see `req`/`res`, controllers stay thin, and business errors use `AppError(msg, status)` with `{ error }` JSON (the global 404 alone uses `{ success, message }`).
- Roles are canonical (`Administrador`, `Coordinador`, `Beneficiario`, `Donante`, `Voluntario`), with legacy `Admin`/`Cliente`/`Empleado` aliases still present in UI/validators. `middlewares/donacionAccess.ts` reads roles from the JWT only, never from body/query; keep literal routes before `/:id(\\d+)` in `donacionRoutes.ts`.
- Campaigns and activities are implemented under `/api/campanas` (public `GET /publicas*`, admin CRUD, coordinator/admin attendance). `GET /api/donaciones/campanas-activas` goes through `services/donacionIntegraciones.ts`.
- Beneficiaries and aid requests are implemented under `/api/ayudas` (`backend/src/{models,validators,repositories,middlewares,services,controllers,routes}/ayuda*`). `solicitud_ayuda` lives in `database/03_solicitudes_ayuda.sql`; the module only writes that table and reuses `beneficiario.estado = 'Verificado'` for eligibility. `solicitudesIntegracion.estaAprobada` now queries `solicitud_ayuda` (only `APROBADA` returns true); `ATENDIDA` closes a request to new assignments.
- Donation photos use memory upload, JPG/PNG/WEBP checked by magic bytes, max 5 files × 5 MB, stored in `backend/storage/donaciones` (private, gitignored). Profile photos go to `backend/uploads/perfiles` and are public under `/uploads`; Compose mounts both directories.
- Triggers own inventory: `trg_recepcion_a_inventario` creates stock for accepted physical donations (not cash), and `trg_controlar_salida_inventario` controls `inventario_destino` rows (exactly one destination, no over-issue). Do not hand-edit inventory balances.

## Frontend conventions

- Provider order is `ThemeProvider → ToastProvider → AuthProvider → App`; the JWT lives in `localStorage("token")`, expires per `exp`, and 15 minutes of inactivity logs out. The Axios interceptor clears the token/redirects on 401 but only logs and propagates 403 (the README claim that 403 logs out is stale).
- Use semantic tokens from `index.css` (`bg-surface`, `text-text-muted`, etc.) rather than raw hex; avoid editing global `index.css` without coordinating, and check mobile/dark mode with UI changes.

## Docs caveats

- `README.md` is the technical contract but partly stale: sections 1.2, 3.3, 5.3, 11.2 and 18.3 still describe donations/campaigns as unimplemented, routes as missing, and 403 as logout. Trust the code and configs.
- `docs/INTEGRACION_CAMPANAS_SOLICITUDES.md` documents the integration contract. `campana`, `actividad`, `solicitud_ayuda`, `fk_inventario_destino_campana` and the `solicitud_ayuda` FKs from `database/03_solicitudes_ayuda.sql` now exist; `docs/AYUDAS.md` documents the implemented module.
- `.env` contains real-looking SMTP/JWT/DB secrets: never commit it, nor `backend/storage/**`, uploads, `dist`, or `node_modules`. `scan-sonar.ps1` and `sonar-project.properties` referenced by the README are gitignored and absent, so Sonar is not part of local verification.

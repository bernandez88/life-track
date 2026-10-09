# Cloudflare: configuración y operación

## 1. Autenticación local

Instala dependencias y autentica Wrangler de forma interactiva:

```bash
npm install
npx wrangler login
```

Verifica el acceso con `npx wrangler whoami`.

## 2. D1 y migraciones

La primera publicación puede crear automáticamente el recurso D1 a partir de `wrangler.jsonc`. Después de publicar el Worker, aplica la migración de forma explícita:

```bash
npm run db:migrate:remote
```

Para desarrollo local:

```bash
npm run db:migrate:local
npm run dev
```

No ejecutes migraciones remotas desde cada Pull Request. Revisa primero el SQL y aplícalo como una operación controlada.

## 3. Secretos

Para el desarrollo local, el token del usuario se define en `.dev.vars` y se almacena hasheado en D1:

```bash
Copy-Item .dev.vars.example .dev.vars
npm run db:seed:local
```

El token real nunca se guarda en el repositorio ni en la base de datos.

Las rutas bajo `/api/v1` requieren este encabezado:

```http
Authorization: Bearer <API_AUTH_TOKEN>
```

`/health` y `/api/v1/health` permanecen públicos para comprobaciones de disponibilidad.

Para trabajar localmente, crea el archivo `.dev.vars` a partir del ejemplo y define un token exclusivo para desarrollo:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

Puedes probar una ruta protegida cuando exista un recurso implementado con:

```bash
curl -H "Authorization: Bearer <API_AUTH_TOKEN>" http://localhost:8787/api/v1/<recurso>
```

Los archivos `.env` y `.dev.vars` son solo locales y están excluidos de Git. Nunca agregues tokens reales a `wrangler.jsonc`, al repositorio ni a los logs.

## 4. GitHub Actions

En el repositorio de GitHub crea estos secretos:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

El token debe estar limitado a la cuenta de life-track y tener solo permisos necesarios para desplegar Workers y administrar los recursos usados por el proyecto.

El workflow ejecuta pruebas en Pull Requests y despliega automáticamente `main`. Las migraciones D1 permanecen separadas y manuales.

## 5. MCP para Codex

Cloudflare ofrece servidores MCP remotos. Para Codex/agentes, registra estos endpoints en la configuración MCP del cliente:

```json
{
  "mcpServers": {
    "cloudflare-api": { "url": "https://mcp.cloudflare.com/mcp" },
    "cloudflare-docs": { "url": "https://docs.mcp.cloudflare.com/mcp" },
    "cloudflare-observability": { "url": "https://observability.mcp.cloudflare.com/mcp" },
    "cloudflare-bindings": { "url": "https://bindings.mcp.cloudflare.com/mcp" },
    "cloudflare-builds": { "url": "https://builds.mcp.cloudflare.com/mcp" }
  }
}
```

Usa OAuth para sesiones interactivas. Para automatizaciones no interactivas, usa un API Token Bearer de alcance mínimo. El MCP no se conecta desde el Worker ni recibe permisos sobre la aplicación en runtime.

## 6. Respaldos diarios en R2

El Worker genera un respaldo JSON de las tablas de D1 cada día a las 06:00 UTC, equivalente a medianoche en El Salvador. Los archivos se guardan como `backups/d1-YYYY-MM-DD.json` en el bucket `life-track-backups`.

El proceso conserva únicamente los cinco respaldos más recientes y elimina los anteriores. El respaldo contiene los datos de las tablas de la aplicación, incluido el hash de los tokens, nunca el token original.

Para habilitarlo, R2 debe estar activado en la cuenta de Cloudflare y debe existir el bucket configurado en `wrangler.jsonc`:

```bash
npx wrangler r2 bucket create life-track-backups
```

Después de crear el bucket, un despliegue del Worker activará el Cron Trigger.

## 7. MCP de life-track

El Worker también expone un MCP específico de la aplicación en:

```text
https://life-track-api.bernandez88.workers.dev/mcp
```

El endpoint usa OAuth 2.1 con Cloudflare Access. El Worker actúa como servidor OAuth para el cliente MCP y como cliente OIDC de la SaaS application `life-track-mcp`. Después de iniciar sesión, el email de Access se asocia con `users.email` y cada herramienta opera únicamente sobre los datos del usuario autenticado.

Herramientas iniciales:

- `list_expense_categories` y `list_activity_types`
- `list_expenses` y `create_expense`
- `list_activities` y `create_activity`
- `list_workouts` y `create_workout`
- `list_notes` y `create_note`

El MCP de life-track es distinto del MCP oficial de Cloudflare: el primero opera datos de la aplicación y el segundo administra infraestructura.

### Secretos OAuth del Worker

No guardes estos valores en GitHub ni en el repositorio. Cárgalos como secretos del Worker:

```bash
npx wrangler secret put ACCESS_CLIENT_ID
npx wrangler secret put ACCESS_CLIENT_SECRET
npx wrangler secret put ACCESS_TOKEN_URL
npx wrangler secret put ACCESS_AUTHORIZATION_URL
npx wrangler secret put ACCESS_JWKS_URL
npx wrangler secret put COOKIE_ENCRYPTION_KEY
```

Los endpoints de Access tienen este formato:

```text
https://<TEAM_NAME>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/token
https://<TEAM_NAME>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/authorization
https://<TEAM_NAME>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/jwks
```

`COOKIE_ENCRYPTION_KEY` debe ser un valor aleatorio de al menos 32 bytes, por ejemplo generado con `openssl rand -hex 32`.

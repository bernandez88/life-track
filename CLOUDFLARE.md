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

Configura el token privado de la API como **Secret**, no como una variable `vars` visible:

```bash
npx wrangler secret put API_AUTH_TOKEN
```

Si lo configuras desde el dashboard, selecciona el tipo **Secret**. No lo agregues como Variable de texto plano.

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

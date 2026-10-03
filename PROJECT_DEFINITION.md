# Personal Data Hub

## 1. Idea del proyecto

Aplicación personal multiusuario para capturar, organizar, consultar y exportar información cotidiana desde un único lugar. El alcance inicial incluye gastos, ejercicios, actividades y notas. El proyecto comienza como una API privada, sin frontend propio ni dominio personalizado, consumible por scripts y agentes de IA, y podrá incorporar un MCP o una interfaz web más adelante sin reemplazar el backend ni la base de datos.

## 2. Objetivos

- Registrar información de manera rápida y consistente.
- Consultar, filtrar, actualizar y eliminar registros propios.
- Mantener los datos organizados por módulo y disponibles para análisis futuro.
- Conservar la propiedad de los datos mediante exportaciones y respaldos.
- Mantener una arquitectura pequeña, de bajo mantenimiento y fácil de ampliar.

## 3. Alcance inicial (MVP)

| Módulo | Funcionalidades iniciales |
| --- | --- |
| Gastos | Registrar fecha, monto, moneda, categoría y descripción; listar y filtrar por fecha o categoría. |
| Ejercicios | Registrar fecha, ejercicio, series, repeticiones, peso y notas; consultar el historial. |
| Actividades | Registrar fecha, tipo, duración opcional y descripción; consultar el historial. |
| Notas | Crear, editar, consultar y eliminar notas con título, contenido y etiquetas opcionales. |

Cada módulo tendrá operaciones CRUD y validación de entradas. Los reportes avanzados, gráficos, automatizaciones e integraciones externas quedan fuera del MVP.

## 4. Arquitectura inicial

```text
Postman / scripts / cliente futuro
              |
           HTTPS
              |
      Cloudflare Workers
      API REST en TypeScript
              |
         Cloudflare D1
           (SQLite)
```

- **Backend:** Cloudflare Workers con TypeScript y Hono para organizar rutas y middleware.
- **Base de datos:** Cloudflare D1 (SQLite), con tablas relacionales e índices según las consultas reales.
- **Acceso inicial:** endpoint HTTPS proporcionado por Workers; no se requiere dominio propio.
- **Frontend inicial:** ninguno. Se consume la API mediante Postman o scripts.
- **Frontend futuro:** aplicación web responsive, desplegable de forma independiente en Cloudflare Pages.
- **Archivos adjuntos futuros:** almacenamiento de objetos (por ejemplo, Cloudflare R2), con referencias en D1; no forma parte del MVP.

### Principios de diseño

- Mantener separados los módulos de dominio, las rutas HTTP y el acceso a datos.
- Usar SQL y migraciones versionadas; evitar almacenar toda la información en un único archivo JSON.
- Usar JSON únicamente para atributos opcionales o flexibles cuando exista una necesidad concreta.
- No incorporar infraestructura ni servicios adicionales antes de necesitarlos.
- Mantener el contrato de la API independiente de cualquier frontend.

## 5. Modelo de datos inicial

Las siguientes entidades son una propuesta base; los campos definitivos se ajustarán durante la implementación.

### `users` y `api_tokens`

- Cada usuario tendrá un identificador estable y un token personal.
- Los tokens se almacenarán únicamente como hashes y podrán revocarse.
- En el MVP se mantendrá un token activo por usuario.

### `expense_categories`

- `id`, `user_id`, `name`, `active`, `created_at`, `updated_at`.
- Cada usuario tendrá su propio catálogo de categorías.

### `activity_types`

- `id`, `user_id`, `name`, `active`, `created_at`, `updated_at`.
- Cada usuario tendrá su propio catálogo de tipos de actividad.

### `expenses`

- `id`, `user_id`, `occurred_at`, `amount`, `currency`, `category_id`, `description`, `created_at`, `updated_at`.
- `amount` se almacenará como entero en la unidad monetaria mínima; por ejemplo, `$25.05` será `2505`.
- `currency` tendrá `USD` como valor predeterminado.

### `workouts`

- `id`, `user_id`, `performed_at`, `exercise`, `sets`, `repetitions`, `weight`, `notes`, `created_at`, `updated_at`.
- El modelo podrá evolucionar a sesiones con múltiples ejercicios si el uso lo requiere.

### `activities`

- `id`, `user_id`, `occurred_at`, `activity_type_id`, `duration_minutes`, `description`, `created_at`, `updated_at`.

### `notes`

- `id`, `user_id`, `title`, `content`, `created_at`, `updated_at`.
- Las etiquetas se normalizarán en `tags` y `note_tags` para facilitar filtros.

**Convenciones:** identificadores estables; fechas de creación y actualización en UTC; fechas de ocurrencia explícitas para registros históricos; validación de campos requeridos y límites de longitud.

## 6. API inicial

Prefijo de rutas: `/api/v1`.

| Recurso | Operaciones |
| --- | --- |
| `/expenses` | Crear, listar, consultar por ID, actualizar y eliminar. |
| `/workouts` | Crear, listar, consultar por ID, actualizar y eliminar. |
| `/activities` | Crear, listar, consultar por ID, actualizar y eliminar. |
| `/notes` | Crear, listar, consultar por ID, actualizar y eliminar. |
| `/health` | Verificar disponibilidad de la API. |

Las listas admitirán paginación y filtros relevantes. Las respuestas usarán JSON, códigos HTTP apropiados y un formato consistente para errores de validación.

## 7. Seguridad y privacidad

- La API será privada: ninguna operación sobre datos personales quedará expuesta sin autenticación.
- Cada usuario tendrá un token personal; el middleware resolverá el `user_id` antes de ejecutar operaciones.
- Todas las consultas sobre datos personales filtrarán por `user_id`.
- Las credenciales y configuraciones sensibles se gestionarán mediante secretos del entorno.
- Se validarán entradas y se limitará el acceso a los recursos del propietario.
- El acceso se realizará exclusivamente mediante HTTPS.
- No se registrarán contenidos sensibles de gastos o notas en logs de aplicación.

## 8. Datos, migraciones y recuperación

- Mantener migraciones SQL versionadas en el repositorio.
- Disponer de exportación de datos a un formato portable, como JSON o CSV, por módulo.
- Definir respaldos periódicos y comprobar que los datos puedan restaurarse.
- Separar los datos de desarrollo y producción cuando exista un ambiente de producción.

## 9. Estructura sugerida del repositorio

```text
/
├── README.md
├── PROJECT_DEFINITION.md
├── src/
│   ├── index.ts
│   ├── modules/
│   │   ├── expenses/
│   │   ├── workouts/
│   │   ├── activities/
│   │   └── notes/
│   ├── middleware/
│   └── shared/
├── migrations/
├── tests/
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

Esta estructura es orientativa; cada módulo podrá separar rutas, validaciones, servicios y consultas cuando su complejidad lo justifique.

## 10. Fases de implementación

1. **Fundamentos:** inicializar repositorio, Workers, Hono, D1, migraciones y pruebas básicas.
2. **Seguridad:** implementar y verificar autenticación antes de habilitar el acceso a datos personales.
3. **MVP de captura:** implementar CRUD, validaciones, filtros y paginación para los cuatro módulos.
4. **Portabilidad:** implementar exportación y procedimiento de respaldo/restauración.
5. **Interfaz opcional:** incorporar un frontend responsive y, si se desea, un dominio propio.

## 11. Decisiones pendientes

Estas decisiones no bloquean la definición base, pero deben resolverse antes o durante la implementación:

- **Autenticación:** token personal por usuario para scripts, agentes y MCP; OAuth queda como evolución futura si se agrega frontend.
- **Modelo de ejercicios:** registro simple por ejercicio; cada fecha representa una sesión implícita.
- **Moneda:** una moneda predeterminada o soporte de múltiples monedas.
- **Captura de actividades:** actividades generales, tareas con estado o seguimiento de hábitos; precisar el alcance.
- **Notas:** texto plano o Markdown; definir si se requieren adjuntos.
- **Respaldo:** frecuencia y destino de las copias independientes.

## 12. Fuera de alcance por ahora

- Aplicación móvil nativa.
- Colaboración multiusuario o permisos por roles.
- Integraciones bancarias, wearables o calendarios.
- Analítica avanzada, IA y notificaciones.
- Facturación, suscripciones o funcionalidades comerciales.

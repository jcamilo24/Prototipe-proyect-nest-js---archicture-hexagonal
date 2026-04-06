# Fase 2

Este documento describe cada cambio realizado para la Fase 2 del proyecto.

---

## Requerimiento 1: Idempotencia de transferencias

**Problema:** Si el cliente envía dos veces la misma transferencia, no se debe ejecutar dos veces.

**Requisitos:**
- El endpoint debe aceptar un header `Idempotency-Key`.
- Guardar esa key.
- Si llega la misma key, devolver la misma respuesta.
- No volver a ejecutar el proceso.

**En el proyecto:** El payload opcional en Redis incluye `id`, `idempotency_key`, `request_hash`, `response`, `status`, `created_at` (ver `idempotency-record.ts`). La persistencia usa **Redis** (`IDEMPOTENCY_KEY_PREFIX`, `IDEMPOTENCY_TTL_SECONDS`).

---

### Qué se hizo

| Componente | Ubicación | Qué hace |
|-----------|-----------|----------|
| Header Idempotency-Key | `transaction/infrastructure/entrypoints/controller/transaction.controller.ts` | `POST .../transfer` recibe `@Headers('idempotency-key')`; si falta → `BadRequestException`. Tras validar, `setIdempotencyKey` (`common/utils/correlation.util.ts`) para que el cliente HTTP/2 reenvíe el mismo header a BREB en la llamada saliente. |
| Hash del request | `src/common/utils/hash.util.ts` | `generateRequestHash(body)` — SHA-256 estable del body; misma key + distinto body → conflicto (no se reutiliza la respuesta cacheada). |
| Registro guardado en Redis | `transaction/infrastructure/idempotency/idempotency-record.ts` | Tipo y factory del objeto serializado en Redis (incluye los campos opcionales del enunciado). |
| Servicio de idempotencia | `transaction/infrastructure/idempotency/redis-idempotency.service.ts` | Implementa `IdempotencyService`: cache hit + mismo hash → devuelve `response` guardado sin ejecutar el callback; miss → ejecuta callback, guarda registro con TTL; mismo key y **distinto** hash → `ConflictException` (409). |
| Cliente Redis | `src/config/redis/redis.provider.ts` | Provee `REDIS_CLIENT` (ioredis) con `REDIS_HOST` / `REDIS_PORT`. |
| Módulo Redis | `src/config/redis/redis.module.ts` | Exporta `REDIS_CLIENT` para quien importe el módulo. |
| Integración en controller | `transaction.controller.ts` | `runCreateTransfer` → `idempotencyService.handle(idempotencyKey, requestHash, async () => { ... use case ... })`. |
| Módulo transacciones | `transaction/transaction.module.ts` | Importa `RedisModule`; registra `provide: 'IdempotencyService', useClass: RedisIdempotencyService`. |
| App | `src/app.module.ts` | `ConfigModule.forRoot` global, `MongooseModule` con URI vía `getMongoUri` (`config/mongo/mongo.config.ts`), importa `TransactionModule`. (La idempotencia no se registra en `AppModule` directamente: llega con `TransactionModule` + `RedisModule`.) |

### Ajuste hexagonal (puerto vs implementación)

**Puerto:** `src/transaction/domain/providers/idempotency.service.ts` — contrato `handle<T>(key, requestHash, execute): Promise<T>`.

**Implementación:** `RedisIdempotencyService` en `infrastructure/idempotency/`.

**Cableado:** `TransactionController` inyecta `@Inject('IdempotencyService')` tipado como `IdempotencyService`, sin importar la clase Redis.

**Conclusión:** La tecnología Redis vive en **infrastructure**; el controller solo conoce el **puerto** definido en **domain/providers**.

---

### Configuración de Mongo (no localhost en producción)

- **Dónde:** `src/config/mongo/mongo.config.ts` — función `getMongoUri(ConfigService)`.
- **Comportamiento:** En desarrollo usa `MONGO_URI` o default `mongodb://localhost:27017/practice-project`. En **producción** (`NODE_ENV=production`) exige `MONGO_URI`; si falta o está vacío, lanza error al arrancar (no se usa localhost por defecto).
- **App:** `app.module.ts` usa `MongooseModule.forRootAsync` inyectando `ConfigService` y llamando a `getMongoUri(configService)`.
- **Secrets:** `MONGO_URI` es una variable sensible cuando incluye credenciales. Ver `docs/SECRETS.md`.

---

### Errores del use case en la capa de aplicación

- **Antes:** `common/errors/use-case-error.mapper.ts` (compartido).
- **Ahora:** `transaction/application/errors/use-case-error.helper.ts` — función `throwUseCaseError(err, context)`: re-lanza `HttpException` y envuelve el resto en `InternalServerErrorException` con contexto.
- **Motivo:** La lógica de “envolver errores con contexto” es de la capa de aplicación; el use case no debe depender de mappers de HTTP (esos los usan los adaptadores).

---

### E2E de idempotencia

- **Ubicación:** `test/transaction/infrastructure/idempotency/transaction.e2e-spec.ts`.
- **Setup:** El módulo de test inyecta un **mock de `IdempotencyService`** en memoria (misma lógica que Redis: misma key + mismo hash → respuesta cacheada; misma key + distinto body → 409). No se usa Redis en e2e.
- **Casos cubiertos:**
  - Mismo body y mismo `Idempotency-Key` dos veces → 201 en ambos, misma respuesta, **una sola** llamada al use case / external / repository.
  - Misma key con body distinto → 409 Conflict.
  - Request sin header `Idempotency-Key` → 400.
- Todos los POST de transfer en e2e envían el header `idempotency-key`.

---

### Lint y tipos

- **main.ts:** `void bootstrap();` para que la promesa no quede “floating”.
- **Tests:** Mocks y respuestas tipados (sin `any`); en e2e se usa `Server` de `http` para el servidor pasado a `request()` (supertest no exporta bien el tipo `App`).
- **Breb adapter:** Respuesta de axios tipada para evitar asignaciones “unsafe”.

---

## Estructura de módulos: ¿`transaction` en root? ¿Se planean más?

- **Estructura actual:** En `src/` está `transaction/` como módulo de negocio (dominio + aplicación + infraestructura). Eso es coherente con tener después más módulos al mismo nivel.

- **Respuesta:**  
  Sí, está pensado para crecer por módulos. Por ahora solo está `transaction`. A futuro se podrían sumar, por ejemplo:
  - `user` (usuarios, auth),
  - `account` (cuentas bancarias),
  - `report` (reportes, conciliación),
  - etc., según el producto.

- **Convención:** Un módulo por bounded context bajo `src/<module>/`. Así queda explícito que la estructura es escalable y que `transaction` no es “el proyecto entero” sino el primer módulo.

---

### Comandos para usar

**¿Cuál comando usar?** Son **dos opciones distintas**; eliges **una** según cómo quieras trabajar:

| Opción | Cuándo usarla | Qué haces |
|--------|----------------|-----------|
| **A) Levantar todo** | Quieres que la API también corra dentro de Docker (todo en contenedores). | Solo ejecutas `docker compose up --build`. |
| **B) Solo Mongo + Redis** | Quieres correr la API en tu máquina (npm) y solo usar Docker para bases de datos. | Ejecutas `docker compose up -d mongo redis` y luego en otra terminal `npm run start:dev`. |

No hace falta ejecutar A y después B; son alternativas.

---

**Opción A – Levantar todo (app + Mongo + Redis en Docker):**
```bash
docker compose up --build
```
La API, Mongo y Redis corren en contenedores. Entras a la API en `http://localhost:3000`.

**Opción B – Solo infraestructura (Mongo + Redis en Docker, API en tu PC):**
```bash
docker compose up -d mongo redis
```
Luego en **otra terminal**, en la raíz del proyecto:
```bash
npm run start:dev
```
Asegúrate de tener en tu `.env`: `MONGO_URI=mongodb://localhost:27017/practice-project`, `REDIS_HOST=localhost`, `REDIS_PORT=6379`. Así la API en tu máquina se conecta a Mongo y Redis que corren en Docker.

**Bajar todo:**
```bash
docker compose down
```

**Bajar y borrar volúmenes (reiniciar datos):**
```bash
docker compose down -v
```

## Requerimiento 2: Fallos del proveedor BREB

**Problema:** Si el mock de BREB falla, no querer que todo se caiga “a la primera” sin política de resiliencia.

**Requisito pedido (retry con backoff):**
- 1.er intento inmediato  
- 2.º a los ~100 ms  
- 3.er a los ~300 ms  
- 4.º a los ~1 s  

Objetivo pedagógico: **resiliencia**, **diseño del adapter** y **manejo de errores**. Opcionalmente se mencionaba **circuit breaker**.

**Nota sobre el “flujo ideal” del enunciado** (varios intentos hasta éxito y que el usuario no note el fallo): en el **código actual no está implementado** ese retry escalonado por petición. La resiliencia se resolvió con **circuit breaker**, que tiene otro comportamiento (ver abajo).

### Qué hay implementado en el proyecto

| Pieza | Ubicación | Rol |
|-------|-----------|-----|
| **Circuit breaker (Opossum)** | Dependencia `opossum` | Abre el circuito tras muchos fallos (según opciones), deja de llamar al upstream un tiempo, luego semiabierto y prueba de nuevo. |
| **Factory genérica** | `transaction/.../http/shared/circuit-breaker.factory.ts` | `createAsyncFnCircuitBreaker` + tipo `CircuitBreakerOptions` — envuelve cualquier `() => Promise<T>`. |
| **Cliente HTTP/2** | `transaction/.../http/client/http2.client.ts` (`Http2ClientImpl`) | `postJson` / `getJson` ejecutan la petición **dentro de** `circuitBreaker.fire(() => …)`. |
| **Opciones del breaker (salida BREB)** | `transaction/.../http/breb/shared/breb-circuit-breaker.options.ts` | `getBrebCircuitBreakerOptions(config)` lee env obligatorias (ver tabla). |
| **Adapters** | `breb/shared/breb-service.base.ts` | Tras fallo HTTP/JSON: `breb_errors`, log, `throwHttpClientError` (`http-client-error.mapper.ts`) para mapear a excepciones HTTP de Nest; el caso de uso sigue con `throwUseCaseError` donde aplique. |

**Variables de entorno del breaker** (todas requeridas para arrancar el cliente; sin defaults en código):

| Variable | Uso típico en Opossum |
|----------|------------------------|
| `BREB_CIRCUIT_TIMEOUT_MS` | Tiempo máximo por invocación protegida. |
| `BREB_CIRCUIT_ERROR_THRESHOLD_PERCENT` | % de fallos para considerar abrir el circuito. |
| `BREB_CIRCUIT_RESET_TIMEOUT_MS` | Cuánto permanece abierto antes de pasar a semiabierto. |
| `BREB_CIRCUIT_VOLUME_THRESHOLD` | Mínimo de mediciones antes de poder abrir el circuito. |

### Por qué circuit breaker en lugar del retry del enunciado

- **Retry con backoff (100 / 300 / 1000 ms):** no está cableado en el cliente actual; cada llamada sería **un** intento HTTP (más lo que Opossum considere fallo dentro del timeout). Reintentar la misma transferencia varias veces seguidas puede **duplicar efectos** si el proveedor no es idempotente más allá del header que ya enviamos.
- **Circuit breaker:** protege al **proveedor** y al **core** cuando BREB va mal: evita martillar al upstream en rachas de error y falla **rápido** al cliente cuando el circuito está abierto (sin nueva llamada HTTP a BREB).

### Arquitectura (opinión alineada al código)

La **resiliencia de transporte** (breaker) vive en **`Http2ClientImpl`**. El **adapter** (`BrebAdapterBase`) orquesta mapeo, métricas y traducción de errores a `HttpException`; **dominio y caso de uso** no conocen Opossum ni las env `BREB_CIRCUIT_*`.

---

## Requerimiento 3: Comunicación entre servicios usando HTTP/2

**Contexto:** En Fase 1 Core ↔ BREB era HTTP/1. En Fase 2 se busca **HTTP/2** en el tramo que toque, manteniendo REST (URLs, métodos, cuerpos) donde aplique.

**Objetivo pedagógico:** Multiplexado, reutilización de conexión y transporte moderno hacia el proveedor.

### Cómo quedó en el repo (importante)

Hay que separar **entrada** (cliente → Core) y **salida** (Core → BREB):

| Tramo | Protocolo hoy | Dónde |
|-------|----------------|--------|
| **Cliente → API Core (servidor Nest)** | **HTTP/1.1** (Fastify por defecto) | `src/main.ts`: `NestFactory.create(AppModule, new FastifyAdapter(), …)` **sin** `{ http2: true }`. Puerto típico `3000`. |
| **Core → BREB (cliente saliente)** | **HTTP/2** (`node:http2`) | `src/transaction/infrastructure/providers/http/client/http2.client.ts` — clase `Http2ClientImpl`. |

Si en el futuro quieres **HTTP/2 también en el servidor** (p. ej. h2c en desarrollo), habría que configurar `FastifyAdapter` con las opciones HTTP/2 que indique la versión de `@nestjs/platform-fastify` / Fastify; **no está activado en el código actual**.

**Conceptos (siguen siendo válidos para el cliente saliente):**

- **Multiplexing:** varios streams en una misma `ClientHttp2Session`.
- **Reuse:** `getSession()` mantiene una sesión por instancia de `Http2ClientImpl` hacia el mismo `origin` hasta que se cierra o falla.

### Cliente HTTP/2 hacia BREB (`Http2ClientImpl`)

| Tema | Detalle |
|------|---------|
| **Archivo** | `transaction/infrastructure/providers/http/client/http2.client.ts` |
| **Interfaz** | `Http2Client`: `postJson(body)`, `getJson(subPath)` |
| **Implementación** | `Http2ClientImpl` + `OnModuleDestroy` → cierra la sesión al apagar el módulo. |
| **Tokens Nest** | `HTTP2_CLIENT_V1` y `HTTP2_CLIENT_V2` (strings `'Http2ClientV1'` / `'Http2ClientV2'`). Export histórico: `BrebHttp2ClientImpl` como alias de `Http2ClientImpl`. |
| **URLs** | No van fijas en el cliente: el módulo instancia **dos** clientes con bases distintas vía `resolveBrebV1BaseUrl` / `resolveBrebV2BaseUrl` en `src/config/breb/breb-http2.config.ts` (`BREB_V1_BASE_URL`, `BREB_V2_BASE_URL`, fallback `BREB_BASE_URL` para v1). |
| **Quién inyecta** | `BrebV1Adapter` → token v1; `BrebV2Adapter` → token v2. Ambos usan `BrebAdapterBase`, que llama `postJson` / `getJson` del puerto `Http2Client`. |
| **Headers salientes** | `x-correlation-id` (si hay contexto), `idempotency-key` si se fijó en la request entrante (`correlation.util`). |
| **Resiliencia** | Cada llamada pasa por **circuit breaker** (`createAsyncFnCircuitBreaker` + env `BREB_CIRCUIT_*`) — ver Requerimiento 2. |

**Flujo de una llamada:** adapter → `brebClient.postJson(mappedBody)` → breaker → `session.request` con `:path` derivado de la URL base → body JSON → parseo de respuesta o error si status ≥ 400 / JSON inválido.

### Fastify vs `node:http2`

| Rol | Librería | Motivo |
|-----|----------|--------|
| **Servidor Nest** | Fastify (vía `FastifyAdapter`) | Framework HTTP entrante; hoy **HTTP/1.1** con la config actual. |
| **Cliente hacia BREB** | `node:http2` | Peticiones salientes HTTP/2 sin depender de axios HTTP/1. |

### Probar la API Core (entrada HTTP/1.1)

Ejemplo coherente con `main.ts` actual (sin `--http2-prior-knowledge`):

```bash
curl -v -X POST "http://localhost:3000/transactions/transfer" \
  -H "Idempotency-Key: test-1" \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-004","amount":111000,"currency":"USD","description":"Test","receiver":{"document":"3006985758","documentType":"CC","name":"MI EMPRESA","account":"323232","accountType":"Ahorros"}}}'
```

Versión BREB v2 en query (opcional): añade `?brebVersion=v2` a la misma URL.

**Mock/servicio BREB:** debe aceptar **HTTP/2** en el puerto/host donde apunten `BREB_V1_BASE_URL` / `BREB_V2_BASE_URL`, porque `Http2ClientImpl` usa `http2.connect`.

---

## Entidad de transacción con lógica de dominio

**Contexto:** Una entidad que solo tiene datos y sin métodos que encapsulen reglas de negocio se considera un “modelo anémico”. Toda la lógica queda en servicios o casos de uso y la entidad no protege sus invariantes.

**Objetivo:** Que la entidad `Transaction` encapsule su estado y solo permita transiciones válidas (de PENDING a SUCCESS o FAILED), centralizando la lógica en el dominio.

### Cambios realizados

| Archivo | Qué se hizo |
|---------|--------------|
| **`transaction.entity.ts`** | La entidad deja de ser un “data bag”: el `status` pasa a ser interno (`_status`) y solo se expone por getter. Se añade `finalizedAt` (fecha de cierre). **Método:** `applyExternalResult(resultStatus)` delega en `validateFinalization`: solo desde **CREATED** se puede pasar a un estado final permitido (**CONFIRMED**, **FAILED**, **REVERSED** o **SUCCESS**); actualiza `_status` y `_finalizedAt`. |
| **`create-transfer.use-case.ts`** | En lugar de `transaction.status = externalResponse.status`, se llama a `transaction.applyExternalResult(externalResponse.status)`. El caso de uso ya no modifica el estado de la transacción directamente. |
| **`transaction.schema.ts`** | Se añade el campo opcional `finalizedAt` para persistir la fecha de finalización. |
| **`transaction.repository.ts`** | El payload de guardado incluye `finalizedAt` cuando existe. |

### Invariantes que protege la entidad

- Solo se puede aplicar `applyExternalResult` si el estado actual es **CREATED**.
- Estados finales admitidos por el validador: **CONFIRMED**, **FAILED**, **REVERSED**, **SUCCESS**.
- Un segundo `applyExternalResult` falla porque ya no se está en **CREATED**.

### Impacto en el proyecto

- **Controller y mappers:** Siguen usando el getter `status` y los mappers de respuesta.
- **Adaptadores (BREB):** Devuelven un `ExternalTransferResult` cuyo `status` ya viene mapeado desde strings del proveedor (p. ej. éxito → **CONFIRMED**).
- **Tests:** Los mocks suelen devolver estados finales compatibles con el validador.

Con esto, la entidad concentra la lógica de transición de estado y el resto del proyecto interactúa con ella a través de su API (`applyExternalResult` y getters).

---

## Uso del enum `TransactionStatus`

Este enum es la única fuente de verdad para los estados de una transacción en el dominio. Se usa en todo el flujo para evitar strings sueltos y tener tipado fuerte.

### Dónde se usa

| Lugar | Uso |
|-------|-----|
| **Entidad `Transaction`** | El estado interno `_status` y el getter `status` son de tipo `TransactionStatus`. El método `applyExternalResult` recibe y valida `TransactionStatus`. |
| **Request mapper** | Al crear la entidad desde el request se usa **`TransactionStatus.CREATED`** como estado inicial. |
| **Contrato externo `ExternalTransferResult`** | El campo `status` es `TransactionStatus`; el adaptador BREB lo rellena tras mapear la respuesta HTTP. |
| **Respuesta API `CreateTransferResponse`** | El campo `status` es `TransactionStatus`; en JSON se serializa como string según el enum (p. ej. `"CREATED"`, `"CONFIRMED"`, `"FAILED"`). |
| **Mapper de BREB `breb-response.mapper.ts`** | Strings del proveedor: `SUCCESS` / `COMPLETED` → **`CONFIRMED`**; `FAILED` / `ERROR` / `REJECTED` → **`FAILED`**; ausente u otro → **`CREATED`**. |
| **Schema Mongoose `transaction.schema.ts`** | El campo `status` tiene `enum: Object.values(TransactionStatus)` y `type: String`. |
| **Registro de idempotencia `idempotency-record.ts`** | Al persistir la respuesta cacheada se guarda `status: TransactionStatus.CONFIRMED` (transferencia completada con éxito en el flujo feliz). |

### Resumen

- **Dominio:** Entidad, puertos y DTOs usan `TransactionStatus`.
- **Infraestructura:** El mapper de BREB traduce strings del proveedor al enum; el schema de Mongo restringe los valores al enum.
- **Consistencia:** No se usan strings literales para estados de transacción; todo pasa por el enum.

---

## Requerimiento 4: Persistencia real de transferencias

### Lista de trabajo (checklist del requerimiento)

1. Enum y validador de transición de estado.  
2. Puerto `TransactionRepository` con `findById`.  
3. `TransactionRepositoryImpl` + mapper documento ↔ dominio.  
4. `GetTransferByIdUseCase`.  
5. `GetTransferResponse` y `mapTransactionToGetResponse`.  
6. **GET** por id con 200 / 404.  
7. Registro en `transaction.module.ts`.  
8. Mapper BREB e idempotencia alineados con estados de dominio (éxito → **CONFIRMED** en el flujo típico).

### Objetivo en el repo

Persistir transferencias en **MongoDB** (colección `transactions`), exponer consulta por id y mantener estados coherentes con `TransactionStatus` y `validateFinalization`.

### Estados (`domain/transaction-status.enum.ts`)

`CREATED`, `SENT`, `SUCCESS`, `CONFIRMED`, `FAILED`, `REVERSED`.

- **Alta (POST):** la entidad nace en **CREATED** (`mapRequestToEntity`).  
- **Tras BREB (feliz):** el mapper suele devolver **CONFIRMED**; el caso de uso llama `applyExternalResult` y persiste.  
- **`validateFinalization`:** solo desde **CREATED** se puede pasar a **CONFIRMED**, **FAILED**, **REVERSED** o **SUCCESS** (`domain/transaction-status.validator.ts`).

### Qué se hizo (resumen)

| Capa | Archivos / pieza | Qué |
|------|-------------------|-----|
| **Dominio** | `transaction.entity.ts`, `transaction.repository.ts` (puerto), `transaction-status.*` | Entidad con `applyExternalResult`; repo con `save` y `findById(id) → Transaction \| null`. |
| **Aplicación** | `get-transfer-by-id.use-case.ts` | `execute(id)`: `findById`; si no hay documento devuelve **`null`** (no lanza `NotFoundException`). |
| **Infra persistencia** | `transaction.repository.ts` (impl), `transaction.mapper.ts`, `transaction.schema.ts` | `findById` por `id`; `toDomain` rehidrata `finalizedAt` si existe en el documento. |
| **Infra BREB / Redis** | `breb-response.mapper.ts`, `idempotency-record.ts` | Éxito remoto `SUCCESS`/`COMPLETED` → **CONFIRMED** en dominio; registro de idempotencia guarda **CONFIRMED** en respuesta cacheada. |
| **API** | `transaction.controller.ts`, `get-transfer.response`, `transaction-request.mapper.ts` | **`GET /transactions/:id`** (no va bajo `/transfer/…`). Si el use case devuelve `null`, el controller responde **404** con cuerpo `{ message: 'Transfer with id … not found' }` usando **`@Res({ passthrough: false })` (Fastify)**; si hay entidad, **200** + DTO. |
| **Módulo** | `transaction.module.ts` | `GetTransferByIdUseCase` registrado; controller con ambos casos de uso. |

### Flujo consistente

- **POST:** `CREATED` → llamada externa → `applyExternalResult(status del resultado)` (típ. **CONFIRMED** o **FAILED**) → `save`.  
- **GET:** lee Mongo; el estado y `finalizedAt` reflejan lo último persistido.

---

## Requerimiento 5: Correlación e idempotencia en contexto (AsyncLocalStorage)

**Objetivo:** Rastrear una request con un **correlation id** común: header `x-correlation-id` en entrada y en la respuesta HTTP, en los logs relevantes y en las llamadas salientes a BREB. Además, reutilizar el mismo **AsyncLocalStorage** para propagar el **`Idempotency-Key`** hacia BREB sin pasar parámetros por todas las capas.

### Implementación

| Paso | Dónde | Qué |
|------|--------|-----|
| **1. Store async** | `src/common/utils/correlation.util.ts` | `AsyncLocalStorage` con objeto `{ correlationId, idempotencyKey? }`. API: `runWithCorrelationId(id, fn)`, `getCorrelationId()`, `setCorrelationId(id)` (sustituye el id en el store actual, si existe), `setIdempotencyKey` / `getIdempotencyKey`. El contexto **solo vive** durante el `fn` de cada request HTTP (no es caché global). |
| **2. Entrada HTTP** | `src/transaction/infrastructure/providers/http/interceptors/correlation-id.interceptor.ts` registrado en `src/app.module.ts` como `APP_INTERCEPTOR` | Lee `x-correlation-id` o `X-Correlation-Id`; si viene vacío o ausente, genera `randomUUID()`. Escribe el valor en la **respuesta** con `response.header('x-correlation-id', id)` y ejecuta el pipeline con `runWithCorrelationId(id, () => …)`. |
| **3. Idempotencia en el mismo store** | `transaction.controller.ts` (`runCreateTransfer`) | Tras validar el header `Idempotency-Key`, llama `setIdempotencyKey(idempotencyKey)` para que el cliente saliente pueda leerlo. |
| **4. Logs** | Controller, casos de uso (`create` / `get`), `BrebAdapterBase`, `http2.client.ts`, `TransactionRepositoryImpl`, `RedisIdempotencyService` | Patrón `correlationId=${getCorrelationId() ?? '-'}` en `log` / `warn` / `error` / `debug` donde aplica. |
| **5. Salida hacia BREB** | `src/transaction/infrastructure/providers/http/client/http2.client.ts` | En cada request HTTP/2: header **`x-correlation-id`** con `getCorrelationId() ?? ''`. Si hay **`getIdempotencyKey()`**, añade **`idempotency-key`** al stream (misma key que envió el cliente al Core). |

### Resumen técnico

- Un **correlation id** por request HTTP entrante, propagado por **AsyncLocalStorage** sin threading manual por firmas de use cases.  
- El **Idempotency-Key** del POST a Core se copia al contexto y sale hacia BREB en el cliente HTTP/2.  
- **Workers / colas (futuro):** al procesar un job, envolver el handler con `runWithCorrelationId(job.correlationId ?? randomUUID(), () => …)` (y, si aplica, `setIdempotencyKey`) para conservar el mismo modelo.

## Requerimiento 6: Métricas

**Objetivo:** Contadores operativos (transferencias creadas/fallidas, llamadas y errores BREB), **persistidos en Redis**, consulta por HTTP en JSON y, además, **exposición Prometheus** en texto plano para scrape.

### Contrato y claves

| Pieza | Archivo | Qué |
|-------|---------|-----|
| **Puerto** | `src/metrics/domain/providers/metrics.service.provider.ts` | `MetricsServicePort`: `increment(...)` y `getMetrics()` **async**; claves: `transfer_created`, `transfer_failed`, `breb_calls`, `breb_errors`. |
| **Implementación** | `src/metrics/infrastructure/providers/http/metrics.service.ts` | Redis **hash**: `HINCRBY` / `HGETALL` en la clave `METRICS_REDIS_KEY` (default `metrics:counters`). Si Redis falla al incrementar o leer → `warn` y **no** tumba el flujo de negocio (incremento omitido o snapshot en ceros). Tras un incremento **exitoso** en Redis, llama `PrometheusMetrics.recordAfterRedisOk(metric)` para mantener alineados los contadores `prom-client` en memoria del proceso. |
| **Prometheus (proceso)** | `src/metrics/infrastructure/prometheus/prometheus.metrics.ts` | Contadores `*_total` (`transfer_created_total`, etc.). `GET /metrics/prometheus` devuelve el texto del registry (`prom-client`). **No** sustituye el snapshot JSON de Redis. |
| **HTTP** | `src/metrics/infrastructure/entrypoints/controller/metrics.controller.ts` | `@Controller()` en raíz: **`GET /metrics`** → JSON desde Redis; **`GET /metrics/prometheus`** → `Content-Type` de Prometheus + cuerpo para scrape. |
| **Módulo** | `src/metrics/metrics.module.ts` | Importa `RedisModule`; registra `MetricsService`, `PrometheusMetrics` y el controller; **exporta** `'MetricsService'` y `PrometheusMetrics`. |

### Quién incrementa qué

| Origen | Archivo | Reglas |
|--------|---------|--------|
| **Crear transferencia** | `create-transfer.use-case.ts` | Fallo en llamada externa → `transfer_failed`. Tras `save` OK → `transfer_created`. Fallo en persistencia → `transfer_failed`. |
| **Adapter BREB** | `transaction/.../breb/shared/breb-service.base.ts` | Antes de `postJson` / `getJson` → `breb_calls`. En `catch` de `sendTransfer` / `getTransferById` → `breb_errors`. (`BrebV1Adapter` / `BrebV2Adapter` inyectan el mismo `MetricsServicePort`.) |

### Cableado con transacciones

- `transaction.module.ts` importa **`MetricsModule`** (y **`RedisModule`** por idempotencia).
- `CreateTransferUseCase` recibe **`MetricsServicePort`** vía token `'MetricsService'`.

### Persistencia Redis (resumen)

- Los cuatro contadores **sobreviven** reinicios de la API mientras Redis conserve el hash.
- **`GET /metrics`** = lectura agregada desde Redis (histórico compartido entre réplicas que usen la misma clave).
- **Prometheus** refleja incrementos **después** de que Redis aceptó el `HINCRBY` en ese proceso (útil para scrape por instancia).

### Notas operativas

- Reset manual: borrar o poner a cero el hash (`METRICS_REDIS_KEY` o default `metrics:counters`).
- **Vaciar Redis en local (idempotencia + métricas):** p. ej. `docker exec -it core_api_redis redis-cli FLUSHDB` o `redis-cli` contra el host; ver **Requerimiento 9** si se documenta borrado selectivo.

---

## Requerimiento 7: Versionamiento del adapter BREB

### Idea general

- **Una sola ruta HTTP** para crear transferencia: `POST /transactions/transfer`.
- Sigue siendo **obligatorio** el header **`Idempotency-Key`** (Requerimiento 1); el versionado BREB es independiente.
- La versión del adapter **no** se fija con variable de entorno global: el cliente puede enviar **`?brebVersion=`** (opcional).
- Tras `trim` + minúsculas, solo **`v2`** selecciona **`BrebV2Adapter`**. **Sin query**, **`v1`** explícito, cadena vacía o **cualquier otro valor** → **`BrebV1Adapter`** (no hay `400` solo por versión desconocida).
- **`parseBrebApiVersion`** devuelve `null` si no es `v1` ni `v2`; **`resolveBrebApiVersion`** hace `?? 'v1'`.
- El **path real** hacia el mock/servicio (`…/transfer` vs `…/payments`) lo define la **URL base** de cada cliente (`BREB_V1_BASE_URL` / `BREB_V2_BASE_URL`), no el nombre del query.

### Dónde vive cada cosa (core vs “otro BREB”)

| Lugar | Rol |
|-------|-----|
| **API (entrada)** | `src/transaction/infrastructure/entrypoints/controller/transaction.controller.ts`: `@Query('brebVersion')` opcional; dentro del handler de idempotencia llama `createTransferUseCase.execute(transaction, brebVersion ?? '')`. |
| **Aplicación** | `src/transaction/application/use-cases/create-transfer.use-case.ts`: `resolveBrebApiVersion(brebApiVersionRaw)`; ternario `v2` → `externalTransferV2`, si no → `externalTransferV1` (tipados como `ExternalTransferService`). |
| **Dominio** | `src/transaction/domain/breb-api-version.ts` |
| **Módulo Nest** | `src/transaction/transaction.module.ts`: providers `HTTP2_CLIENT_V1` / `HTTP2_CLIENT_V2` → dos `Http2ClientImpl`; `BrebV1Adapter`, `BrebV2Adapter`; `CreateTransferUseCase` con ambos adapters inyectados (**sin** provider factory `'ExternalTransferService'`). |
| **Infra BREB** | `BrebAdapterBase` + `BrebV1Adapter` / `BrebV2Adapter` |
| **Servicio externo** | Debe hablar **HTTP/2** en las URLs configuradas (cliente saliente). |

### Qué se hizo (resumen técnico)

| Pieza | Archivo(s) | Qué |
|------|------------|-----|
| **Puerto** | `src/transaction/domain/providers/external-transfer.service.ts` | Contrato `sendTransfer` / `ExternalTransferResult`; ambos adapters lo cumplen. |
| **Versión en request** | `transaction.controller.ts` | `POST('transfer')` + query opcional → `createTransferUseCase.execute(transaction, brebVersionRaw)`. |
| **Elección de adapter** | `create-transfer.use-case.ts` + `breb-api-version.ts` | Ver arriba. |
| **Base BREB** | `src/transaction/.../http/breb/shared/breb-service.base.ts` | Mapeo, métricas, logs; sin ramas por versión. |
| **Adapters** | `.../breb/v1/breb-v1.adapter.ts`, `.../breb/v2/breb-v2.adapter.ts` | `@Inject(HTTP2_CLIENT_V1)` / `HTTP2_CLIENT_V2`. |
| **Cliente HTTP/2** | `src/transaction/.../http/client/http2.client.ts` | `Http2ClientImpl`; tokens `HTTP2_CLIENT_V1` / `V2`; alias export `BrebHttp2ClientImpl`. Breaker: `.../http/shared/circuit-breaker.factory.ts` + `breb-circuit-breaker.options.ts`. |
| **URLs** | `src/config/breb/breb-http2.config.ts` | `resolveBrebV1BaseUrl` / `resolveBrebV2BaseUrl`. |
| **Mappers / errores** | `.../breb/mappers/*`, `http-client-error.mapper.ts` | Compartidos v1/v2 si el JSON es compatible. |

### Variables de entorno (versionamiento / destino)

| Variable | Descripción |
|----------|-------------|
| `BREB_V1_BASE_URL` | Base “v1” (típ. path `.../transfer`). Fallback `BREB_BASE_URL` y default en código. |
| `BREB_V2_BASE_URL` | Base “v2” (típ. `.../payments`). |
| `BREB_BASE_URL` | Fallback para v1 si no hay `BREB_V1_BASE_URL`. |

No se usa **`BREB_ADAPTER_VERSION`** para elegir un único adapter en todo el proceso.

### Desacoplamiento

- **Adapters y `Http2ClientImpl`** no leen el query; solo usan su URL base inyectada.
- **Caso de uso** concentra la regla de selección y el default **v1**.
- **v3 futuro:** nuevo adapter, token de cliente, URL en config y ampliar `breb-api-version` / el ternario del caso de uso.

### Carpetas (bajo `src/transaction/infrastructure/providers/http/`)

| Ruta relativa | Contenido |
|---------------|-----------|
| `client/` | `http2.client.ts` |
| `shared/` | `circuit-breaker.factory.ts` |
| `breb/shared/` | `breb-service.base.ts`, `breb-circuit-breaker.options.ts`, errores, mappers |
| `breb/v1/`, `breb/v2/` | Adapters |
| `interceptors/` | Correlation id |

### Mock / BREB externo

Mocks deben escuchar en las bases configuradas (v1 vs v2). El core solo elige adapter y URL; no implementa reglas de negocio del proveedor.

### Ejemplos (`curl`)

Default v1 (HTTP/1.1 hacia Core, como en `main.ts` actual):

```bash
curl -s -X POST "http://localhost:3000/transactions/transfer" \
  -H "Idempotency-Key: req-7-demo" \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-r7","amount":1,"currency":"USD","description":"d","receiver":{"document":"1","documentType":"CC","name":"n","account":"1","accountType":"Ahorros"}}}'
```

Forzar adapter v2:

```bash
curl -s -X POST "http://localhost:3000/transactions/transfer?brebVersion=v2" \
  -H "Idempotency-Key: req-7-v2" \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-r7-v2","amount":1,"currency":"USD","description":"d","receiver":{"document":"1","documentType":"CC","name":"n","account":"1","accountType":"Ahorros"}}}'
```

Valor desconocido (`v99`, etc.) → mismo comportamiento que sin query (**v1**).

---

## Requerimiento 8: Tests reales (cobertura e integración BREB)

**Objetivo del requerimiento:** (1) Mantener **al menos ~80% de cobertura** en tests unitarios sobre **casos de uso** de transacciones y la **capa adapter BREB** (v1, v2 y la base compartida). (2) Tener **un test de integración** que ejecute el flujo **crear transferencia → llamada HTTP/2 real a un “mock BREB”** (servidor embebido en el test que habla el mismo contrato que BREB), sin sustituir el cliente HTTP por mocks.

### Desglose

| Pieza | Qué significa | Cómo se cumple en el repo |
|--------|----------------|---------------------------|
| **Unit tests — use cases** | Cobertura de líneas/ramas/funciones en `CreateTransferUseCase` y `GetTransferByIdUseCase` (lógica de aplicación aislada con repos y `ExternalTransferService` mockeados). | Specs en `test/transaction/application/use-cases/*.spec.ts`; casos felices y de error (fallo externo, fallo persistencia, re-lanzamiento de `HttpException`). |
| **Unit tests — adapters** | Cobertura en los adapters HTTP BREB: clases finas en `v1/` y `v2/` más la lógica compartida en `breb-service.base.ts` (`sendTransfer`, `getTransferById`, métricas y errores). | `test/.../breb/v1/breb-v1.adapter.spec.ts`, `.../v2/breb-v2.adapter.spec.ts`; además specs de mappers, `breb-circuit-breaker.options`, `http-client-error.mapper` y `circuit-breaker.factory` bajo `test/transaction/infrastructure/providers/http/`. |
| **Cobertura global (`All files`)** | El informe de Jest incluye todo `src/` salvo entradas puramente de cableado. | `collectCoverageFrom` excluye `src/main.ts` y `src/**/*.module.ts` (bootstrap y módulos Nest sin lógica testeable unitaria); el resto se cubre con specs alineados a `src/` (config, métricas, persistencia, BREB shared, interceptor, etc.). Con las suites actuales la línea global suele situarse **≥ ~80%** en líneas. |
| **Umbral 80% (rutas críticas)** | Jest falla `npm run test:cov` si esas rutas bajan del mínimo acordado. | `coverageThreshold` en `package.json` para `src/transaction/application/use-cases/**/*.ts`, `.../breb/v1/**/*.ts`, `.../breb/v2/**/*.ts` y `.../breb/shared/breb-service.base.ts`. |
| **Integración transfer → mock BREB** | Un test que atraviese caso de uso + adapter + **cliente HTTP/2 real** (`BrebHttp2ClientImpl`, alias de export de `Http2ClientImpl` en `http2.client.ts`) sin mockear `postJson`. | `test/integration/transfer-breb.integration-spec.ts`: `http2.createServer` en puerto aleatorio; solo atiende `POST /transfer` con JSON compatible con el mapper BREB; `baseUrl` del cliente incluye el path (`…/transfer`). Arma `CreateTransferUseCase` con `BrebV1Adapter` + repo en memoria y un **stub de v2** que fallaría si se usara; `execute(transaction, 'v1')`. Dentro de `runWithCorrelationId` + `setIdempotencyKey` comprueba que el mock recibe el header **`idempotency-key`**. No requiere el script `mock:breb` ni otro proceso para CI. |

### Estructura de `test/` (alineada a `src/`)

Los unit tests viven bajo `test/` siguiendo el mismo árbol que el código de producción: por ejemplo `test/transaction/application/use-cases/`, `test/transaction/infrastructure/providers/http/breb/...`, `test/config/mongo/`, `test/metrics/infrastructure/...`. Hay también `test/transaction/infrastructure/entrypoints/controller/transaction.controller.spec.ts`. Lo compartido transversal sigue en `test/common/`. E2E: `test/app.e2e-spec.ts`, `test/transaction/infrastructure/idempotency/transaction.e2e-spec.ts` (config `test/jest-e2e.json`, `testRegex: .e2e-spec.ts$`). Integración: `test/integration/**/*.integration-spec.ts` vía `test/jest-integration.json` (`testMatch` acotado a esa carpeta).

### Comandos

- **Unit tests + cobertura (con umbrales):** `npm run test:cov`
- **E2E (HTTP sobre app de prueba):** `npm run test:e2e` (config `test/jest-e2e.json`; archivos `*.e2e-spec.ts`)
- **Solo integración BREB:** `npm run test:integration` (config `test/jest-integration.json`; los `*.integration-spec.ts` están excluidos del `jest` unitario por `testPathIgnorePatterns`).

Para ejecutar **las tres tandas en secuencia** (lo habitual antes de un PR o una demo):

```bash
npm run test:cov && npm run test:e2e && npm run test:integration
```

**Ejemplo de totales “All files”** tras `npm run test:cov` (varían al cambiar código o tests; la fila final del informe es la fuente de verdad):

| Métrica | Porcentaje (ejemplo) |
|---------|----------------------|
| Statements (% Stmts) | 81,08% |
| Branches (% Branch) | 73,95% |
| Functions (% Funcs) | 69,23% |
| Lines (% Lines) | 81,39% |

Los **umbrales al 80%** en `coverageThreshold` aplican solo a use cases y rutas BREB indicadas en `package.json`; el agregado global puede tener ramas/funciones por debajo sin romper el build si las rutas umbral cumplen.

Si los tres comandos terminan con código de salida **0** y ves **PASS** en cada suite, **no hay errores de prueba**: todo lo que fallaría aparecería como **FAIL** y Jest devolvería un código distinto de cero.

### Cómo leer la salida (qué es cada cosa)

| Qué ves en consola | Qué significa |
|--------------------|----------------|
| **`PASS test/.../*.spec.ts`** | Ese archivo de tests **pasó**. El orden de ejecución puede variar; lo importante es el resumen final de cada comando. |
| **`Test Suites: N passed`** / **`Tests: M passed`** | Resumen del comando actual: **N** archivos de test y **M** casos ejecutados con éxito. Si hubiera fallos, aparecería `failed` y el detalle del caso. |
| **`[Nest] ... ERROR`** | Mensaje del **logger de Nest** dentro del código bajo prueba. En muchos specs es **esperado** (por ejemplo el adapter BREB que prueba respuestas inválidas o red caída). **No** indica que Jest haya fallado si la línea anterior o posterior dice **PASS**. |
| **`[Nest] ... WARN`** | Igual: avisos de lógica (idempotencia conflict, métricas con Redis mockeado que falla a propósito, etc.). |
| **`[Nest] ... DEBUG` / `LOG`** | Trazas normales del flujo (casos de uso, repositorio, idempotencia). |
| **Tabla `% Stmts` / `% Lines` / `All files`** | Informe de **cobertura** solo en `npm run test:cov`. Indica qué porcentaje del código incluido en `collectCoverageFrom` se ejecutó al menos una vez. Valores bajos en **`http2.client.ts`** en unitarios son normales: ese cliente se ejerce en el **test de integración** HTTP/2, no en todos los unit tests. |
| **`Running coverage on untested files...`** | Mensaje de Istanbul/Jest mientras termina de instrumentar; a veces se mezcla con logs de tests que aún escriben en consola. |
| **`Force exiting Jest: Have you considered using --detectOpenHandles`** | **Aviso** de Jest porque en `jest-e2e.json` e `jest-integration.json` está `forceExit: true`. No es un fallo; solo sugiere depurar handles abiertos si algún día quisieras quitar `forceExit`. |
| **`A worker process has failed to exit gracefully... force exited`** | Suele aparecer en **`test:e2e`** junto al aviso anterior: timers u otros handles del **TestModule** de Nest no cerrados antes del `forceExit`. Si la suite dice **PASS**, el resultado del test es válido. |

### Preguntas frecuentes (cómo explicarlo en una revisión)

- **¿Cómo hicieron las pruebas?** — Unitarios con Jest + `@nestjs/testing` (mocks de repositorio, BREB, Redis, métricas), e2e con `supertest` sobre una app Nest mínima en memoria, e integración con un servidor HTTP/2 embebido que simula BREB.
- **¿Eso que dice ERROR es que algo está mal?** — No, si el test **PASS**: son logs del dominio simulando errores (BREB inválido, conflicto de idempotencia, etc.).
- **¿Hay errores reales?** — Solo si aparece **FAIL**, un stack trace de expectativa (`Expected ... Received ...`) o el comando termina con **exit code ≠ 0**.
- **¿Por qué “All files” ~80% y no 100%?** — Se excluyen `main` y módulos `.module.ts` del cómputo; además no todo el código tiene el mismo peso (p. ej. cliente HTTP/2 muy cubierto en integración). Los **umbrales obligatorios** están en use cases y adapters BREB vía `coverageThreshold`.

---

## Requerimiento 9: Concurrencia (pruebas y lecciones operativas)

**Contexto:** Las pruebas de concurrencia aquí son principalmente **manuales o con scripts** (no sustituyen los tests automatizados del Requerimiento 8). Sirven para ver comportamiento bajo **muchas peticiones en paralelo** hacia `POST /transactions/transfer` (opcionalmente `?brebVersion=v2`), con Redis, Mongo y BREB reales o mock.

### Qué pruebas puedes hacer

| Prueba | Qué configurar | Qué observar |
|--------|----------------|--------------|
| **Carga “feliz”** | N peticiones en paralelo (p. ej. **100** en `scripts/concurrency-test.ts`) con **`Idempotency-Key` distinta por petición** (el script usa `key-${runId}-${index}` con `runId = Date.now()` para no chocar con Redis de corridas anteriores) y **`transaction.id` distinto** (`tx-${index}`). | `Resumen HTTP` con muchos **201**; en Mongo N documentos en `transactions`; `GET /metrics` con contadores **`transfer_created`** y **`breb_calls`** (y **`breb_errors`** si hubo fallos upstream). |
| **Mismo id hacia BREB** | Varias peticiones concurrentes con el **mismo `transaction.id`** (mismo body salvo que el mock/BREB rechace duplicados). | El upstream puede responder **409**. El cliente HTTP/2 rechaza con un error que lleva **`response.status`**; `throwHttpClientError` en `http-client-error.mapper.ts` trata ese shape y traduce **4xx del upstream → 502 Bad Gateway** con mensaje tipo **`external service rejected request (409)`**. No confundir con idempotencia de la API. |
| **Idempotencia: misma key, mismo body** | Dos ráfagas o dos envíos con la **misma** `Idempotency-Key` y **el mismo** JSON. | Segunda respuesta debe coincidir con la primera; el flujo de negocio no debe ejecutarse dos veces (comprobar logs o contadores). |
| **Idempotencia: misma key, distinto body** | Misma key en peticiones con **cuerpos distintos** (p. ej. mismo header, distinto `transaction.id`). | **409 Conflict** desde `RedisIdempotencyService`: cuerpo/mensaje **`Idempotency-Key reused with different payload`**. |
| **Redis vs Mongo** | Borrar solo la colección `transactions` en Mongo y repetir peticiones con las **mismas** keys de idempotencia que ya usaste. | Puede “parecer éxito” (201 cacheado) **sin** nuevos inserts: la respuesta sale de **Redis** (`<IDEMPOTENCY_KEY_PREFIX>:<header>`, default `idempotency:<valor-del-header>`), no se vuelve a persistir. Para un estado limpio, borrar esas claves o usar keys nuevas por corrida. |
| **Circuit breaker BREB** | Muchos fallos seguidos contra BREB (timeouts, 4xx/5xx masivos, etc.). Opossum (`createAsyncFnCircuitBreaker` en `circuit-breaker.factory.ts`, opciones `BREB_CIRCUIT_*`). | Con el circuito **abierto**, `fire()` rechaza con error cuyo mensaje es literalmente **`Breaker is open`**. Ese error **no** lleva `response.status`; el mapper acaba en **`InternalServerErrorException`** (`external service call failed`, con la causa en `description`). El caso de uso **re-lanza** `HttpException` sin envolverla, así que el cliente ve **500**. El core deja de llamar al upstream mientras el breaker siga abierto (hasta `resetTimeout`). |
| **Herramientas** | `npm run test:concurrency` ejecuta `scripts/concurrency-test.ts`: **`POST`** fijo a `http://localhost:3000/transactions/transfer` (comentario en código para añadir `?brebVersion=v2` si hace falta), **`PARALLEL_REQUESTS = 100`**, escribe **`scripts/concurrency-output-<runId>.json`** con resumen y resultados; **`CONCURRENCY_VERBOSE=1`** o **`true`** vuelca el detalle de `Promise.allSettled` en consola. | Alternativas: autocannon, k6, Apache Bench; subir carga de a poco (10 → 50 → 100). |

### Lo más importante que conviene tener claro (antes de exigir concurrencia “de verdad”)

1. **`Promise.allSettled` / `fetch` “fulfilled” no es éxito de negocio.** Hay que mirar **`status` HTTP** (201 vs 409 vs 502 vs 500) y el cuerpo; por eso el script registra `res.status` y el JSON de error.
2. **Idempotencia vive en Redis** (`IDEMPOTENCY_KEY_PREFIX`, default `idempotency` → claves **`idempotency:<valor-del-header-Idempotency-Key>`** en `redis-idempotency.service.ts`). **Vaciar Mongo no borra** respuestas cacheadas; las métricas están en otro hash: env **`METRICS_REDIS_KEY`**, default **`metrics:counters`** (`metrics.service.ts`).
3. **409 de idempotencia (API)** vs **409 del BREB (upstream):** el primero es **`ConflictException`** por **misma key + distinto payload** en la capa de idempotencia. El segundo lo produce BREB; **`Http2ClientImpl`** adjunta **`response: { status }`** al error y `throwHttpClientError` aplica la rama **4xx → 502** (no hace falta que sea Axios).
4. **Mismo `transaction.id` en muchas peticiones paralelas** puede disparar **409 en BREB** y luego **apertura del circuit breaker**; no es un fallo del script de concurrencia, es presión sobre las reglas del mock/servicio externo.
5. **Reset local rápido:** `docker exec -it core_api_redis redis-cli FLUSHDB` vacía idempotencia y métricas en esa base Redis; para solo métricas, `DEL` de la clave configurada (p. ej. `metrics:counters`); para solo idempotencia, borrar el patrón acorde al prefijo (p. ej. `idempotency:*`) — ver Requerimiento 6 en este documento.

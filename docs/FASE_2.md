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

**Opcional:** Guardar `id`, `idempotency_key`, `request_hash`, `response`, `status`, `created_at`.  
**Pista:** Usar Redis en el primer componente.

---

### Qué se hizo

| Componente | Ubicación | Qué hace |
|-----------|-----------|----------|
| Header Idempotency-Key | `transaction.controller.ts` | El endpoint recibe `@Headers('idempotency-key')` y exige que venga; si no, lanza `BadRequestException`. |
| Hash del request | `common/helpers/hash.helper.ts` | `generateRequestHash(body)` genera SHA256 del body para detectar mismo key con distinto payload. |
| Servicio de idempotencia | `transaction/infrastructure/idempotency/redis-idempotency.service.ts` | Usa Redis: si existe key con mismo request_hash devuelve la respuesta guardada; si no, ejecuta el callback, guarda y devuelve. |
| Redis provider | `common/redis/redis.provider.ts` | Provee el cliente Redis (`REDIS_CLIENT`) con host/port. |
| Integración en controller | `transaction.controller.ts` | Llama a `idempotencyService.handle(idempotencyKey, requestHash, async () => { ... })` para envolver la creación de la transferencia. |
| Módulo | `transaction.module.ts` | Registra `RedisProvider` y `RedisIdempotencyService`. |
| App | `app.module.ts` | Usa `ConfigModule` y `MONGO_URI`; Mongo por variable de entorno. |

#### 4. Ajuste para respetar el patrón hexagonal

**Nuevo puerto:** `src/transaction/domain/providers/idempotency.service.ts`

**Idea:** el controller ya no depende directamente de una implementación concreta de Redis.  
Ahora depende del puerto `IdempotencyService`, y en el módulo se conecta ese puerto con la implementación `RedisIdempotencyService`.

**Antes:**
- `TransactionController` dependía de `RedisIdempotencyService` (infraestructura concreta).

**Ahora:**
- `TransactionController` depende de `IdempotencyService` (abstracción).
- `RedisIdempotencyService` queda como adaptador de infraestructura.

**Conclusión de arquitectura:**  
La **implementación Redis sí debe vivir en `infrastructure`**, porque Redis es una tecnología externa.  
Lo que no conviene es que el controller conozca esa implementación concreta; por eso se creó el puerto en `domain/providers`.

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

### Paso 5: Comandos para usar

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

**Problema:** Si el mock de breb falla se cae inmediatamente sin reintentos 

**Requisitos:**
- primer intento inmediato
- segundo intento en 100ms
- tercero en 300ms
- cuarto en 1 segundo

Esto te permite evaluar:

resiliencia
diseño del adapter
manejo de errores

**Opcional:** Circuit breaker
**Flujo final:** retry con backoff
Attempt 1 → falla

espera 100ms

Attempt 2 → falla

espera 300ms

Attempt 3 → falla

espera 1s

Attempt 4 → éxito

El usuario no se entera del fallo.

Eso es resiliencia.

**Opinion:**  Porque el adapter es el responsable de la integración externa.
El dominio y los casos de uso no deben conocer detalles
de resiliencia de infraestructura.

---

## Circuit breaker con Opossum (sustituye retry manual / p-retry)

Se quitó la lógica de reintentos con backoff (manual y la prueba con p-retry) y se pasó a **circuit breaker** usando la librería **Opossum**.

### Qué se hizo

- **Librería:** `opossum` en dependencias. Opossum es un circuit breaker para Node: abre el circuito cuando hay muchos fallos, deja de llamar al proveedor un tiempo, y luego prueba de nuevo (semiabierto).
- **Servicio BREB (`breb.service.ts`):**  
  - La llamada real a BREB está en un método privado `callBreb(transaction)`.  
  - Ese método se envuelve en un circuit breaker creado en el constructor.  
  - `sendTransfer(transaction)` solo hace `this.breaker.fire(transaction)`; si el breaker rechaza (circuito abierto o error), se captura y se pasa a `throwHttpClientError(err)`.
- **Factory del breaker (`breb-circuit-breaker.factory.ts`):**  
  - Toda la configuración del breaker (opossum, opciones, eventos) está en una factory en la misma capa HTTP.  
  - Opciones: `timeout` 5 s, `errorThresholdPercentage` 50, `resetTimeout` 10 s, `volumeThreshold` 5 (mínimo 5 llamadas antes de poder abrir).  
  - Eventos `open`, `halfOpen`, `close` se registran ahí y se loguean.  
  - El servicio BREB solo llama a `createBrebCircuitBreaker(this.callBreb.bind(this), this.logger)` y guarda la instancia.

### Por qué circuit breaker y no solo retry

- **Retry (p-retry o manual):** Reintenta la misma petición varias veces; no “recuerda” que el servicio lleva fallando. Con el servicio caído, cada request hace varios intentos y todo sigue fallando.
- **Circuit breaker:** Tras varios fallos (según umbral y volumen), **deja de llamar** al proveedor un tiempo (circuito abierto). Las peticiones fallan rápido (sin llamar a BREB). Tras `resetTimeout`, se pasa a semiabierto, se prueba una llamada y, si va bien, se cierra otra vez. Así se evita saturar un servicio caído y se responde antes al cliente cuando BREB no está disponible.

---

### Requerimiento 3: Comunicación entre servicios usando HTTP/2

**Contexto:** En Fase 1 la comunicación entre API Core y API BREB (mock/adapter) es HTTP/1 con REST. En Fase 2 el objetivo es que el **transporte** sea HTTP/2; el contrato REST (URLs, métodos, cuerpos) puede seguir igual.

**Objetivo:** Cambiar la comunicación entre las dos APIs para usar HTTP/2 en lugar de HTTP/1.

**Qué debe quedar implementado:**

1. Levantar el servidor NestJS con soporte HTTP/2 (que los clientes que llamen a Core puedan usar HTTP/2).
2. El adapter que llama a BREB debe usar un **cliente HTTP/2** (no axios/HTTP/1).
3. La comunicación entre servicios debe funcionar efectivamente sobre HTTP/2.
4. Documentar qué se cambió y por qué (este mismo doc).

**Conceptos que debes considerar:**

- **Connection multiplexing (multiplexado):** En HTTP/2 una sola conexión TCP puede llevar **varios requests/responses a la vez** (streams). No hace falta una conexión por request.
- **Connection reuse (reutilización):** Reutilizar **una misma conexión** (o “sesión” HTTP/2) para muchos requests al mismo host (BREB), en lugar de abrir una conexión nueva por cada request. Eso reduce latencia y uso de recursos.

---

### Fastify vs node:http2 — por qué se usan los dos

En el proyecto hay **dos papeles** de HTTP/2; por eso aparecen Fastify y el módulo nativo `node:http2`:

| Quién | Papel | Qué se usa | Para qué |
|-------|--------|------------|----------|
| **API Core (servidor)** | Recibe peticiones | **Fastify** (adaptador en Nest) | Que la app escuche en HTTP/2 (p. ej. curl → Core). |
| **API Core (cliente)** | Hace peticiones a BREB | **node:http2** | Que Core llame a BREB en HTTP/2 (Core → BREB). |

- **Fastify** es un framework para **crear servidores**. Se usa en `main.ts` con `FastifyAdapter({ http2: true })` para que Nest levante un **servidor** HTTP/2. No sirve para hacer peticiones salientes.
- Para **peticiones salientes** (cliente) en HTTP/2 desde Node se usa el módulo nativo **`node:http2`**. Por eso el adapter que llama a BREB está implementado con ese módulo.

---

### Elección: Fastify

Para el servidor Nest (API Core) se usará **Fastify** con HTTP/2.

**HTTP/2 sin TLS (desarrollo)**

Con solo `http2: true`, Fastify puede levantar HTTP/2 en **cleartext** (h2c), válido para desarrollo y para clientes que soporten h2c (p. ej. otro servicio Node). No hace falta certificado.

El servidor está en **HTTP/2**; **Postman** no maneja bien HTTP/2 (sobre todo en cleartext/h2c) y puede mostrar “Parse Error: malformed response”. Para probar la API en HTTP/2 se usa el curl:
**Ejemplo con curl (POST al transfer):**  
El servidor Fastify usa HTTP/2 directo (prior knowledge); curl debe usar `--http2-prior-knowledge` para no hacer Upgrade y evitar el error "Received HTTP/0.9 when not allowed".
```bash
curl -v --http2-prior-knowledge -X POST http://localhost:3000/transactions/transfer \
  -H "Idempotency-Key: test-1" \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-004","amount":111000,"currency":"USD","description":"Test","receiver":{"document":"3006985758","documentType":"CC","name":"MI EMPRESA","account":"323232","accountType":"Ahorros"}}}'
```

#### Archivo: `breb-http2.client.ts`

**Ubicación:** `src/transaction/infrastructure/providers/http/breb/client/breb-http2.client.ts`

**Propósito:** Encapsular la comunicación HTTP/2 con BREB en un solo lugar: una sesión reutilizada, POST con body JSON y cierre ordenado al apagar el módulo.

| Parte | Qué hace |
|-------|----------|
| **Token / interfaz** | `BREB_HTTP2_CLIENT` es el token de inyección. La interfaz `BrebHttp2Client` expone solo `postJson(body): Promise<unknown>`. |
| **URL** | La base URL se toma de `process.env.BREB_BASE_URL` (por defecto `http://localhost:3001/transfer`). Se usa `URL` para obtener host, puerto, path y scheme. |
| **Cierre** | La clase implementa `OnModuleDestroy`. En `onModuleDestroy()` se cierra la sesión con `session.close()` y se pone la referencia a `null`, de forma que al apagar la app no queden conexiones abiertas. |

## Reuse (reutilización): 
En breb-http2.client.ts, getSession() devuelve siempre la misma ClientHttp2Session si existe y no está cerrada; solo se crea una nueva con http2.connect(origin) la primera vez. Todas las llamadas a postJson (y por tanto todos los sendTransfer) usan esa misma sesión → una sola conexión TCP reutilizada.

## Multiplexing: 
En HTTP/2 cada request usa un stream distinto sobre la misma sesión. En nuestro cliente, cada postJson hace un session.request() (un stream nuevo). Si se hacen varias llamadas concurrentes a BREB, todas usan la misma sesión y streams distintos → multiplexing “de fábrica” con la implementación actual.

**Flujo en una llamada:**  
Adapter llama a `brebClient.postJson(body)` → el cliente obtiene o crea la sesión → abre un *stream* sobre esa sesión (POST al path de la URL) → escribe el body → lee la respuesta → devuelve el JSON parseado (o lanza si status ≥ 400 o JSON inválido). Varias llamadas usan la **misma sesión** (connection reuse) y, en HTTP/2, pueden usar streams distintos en paralelo (multiplexing).

**Quién lo usa:**  
`BrebAdapter` recibe por inyección `BrebHttp2Client`; en el módulo se provee `BrebHttp2ClientImpl`. En tests se puede inyectar un mock que implemente `postJson` para no depender de un servidor real.

---

curl -v --http2-prior-knowledge -X POST http://localhost:3000/transactions/transfer \
  -H "Idempotency-Key: test-2" \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-005","amount":111000,"currency":"USD","description":"Test","receiver":{"document":"3006985758","documentType":"CC","name":"MI EMPRESA","account":"323232","accountType":"Ahorros"}}}'

---

## Entidad de transacción con lógica de dominio

**Contexto:** Una entidad que solo tiene datos y sin métodos que encapsulen reglas de negocio se considera un “modelo anémico”. Toda la lógica queda en servicios o casos de uso y la entidad no protege sus invariantes.

**Objetivo:** Que la entidad `Transaction` encapsule su estado y solo permita transiciones válidas (de PENDING a SUCCESS o FAILED), centralizando la lógica en el dominio.

### Cambios realizados

| Archivo | Qué se hizo |
|---------|--------------|
| **`transaction.entity.ts`** | La entidad deja de ser un “data bag”: el `status` pasa a ser interno (`_status`) y solo se expone por getter. Se añade `finalizedAt` (fecha de cierre). **Método nuevo:** `applyExternalResult(resultStatus: TransactionStatus)`: valida que el estado actual sea `PENDING`, que el resultado sea `SUCCESS` o `FAILED`, actualiza `_status` y asigna `_finalizedAt = new Date()`. Es la única forma de pasar de PENDING a un estado final. |
| **`create-transfer.use-case.ts`** | En lugar de `transaction.status = externalResponse.status`, se llama a `transaction.applyExternalResult(externalResponse.status)`. El caso de uso ya no modifica el estado de la transacción directamente. |
| **`transaction.schema.ts`** | Se añade el campo opcional `finalizedAt` para persistir la fecha de finalización. |
| **`transaction.repository.ts`** | El payload de guardado incluye `finalizedAt` cuando existe. |

### Invariantes que protege la entidad

- Solo se puede “finalizar” una transacción que está en **CREATED**.
- El estado final solo puede ser **SUCCESS** o **FAILED** (no se acepta otro valor).
- Si se intenta llamar `applyExternalResult` dos veces o con estado distinto de PENDING, la entidad lanza error y evita estados inconsistentes.

### Impacto en el proyecto

- **Controller y mappers:** Sin cambios; siguen leyendo `transaction.status` (getter) y construyendo la respuesta.
- **Adaptadores (BREB, Redis):** Sin cambios; no dependen del estado interno de la entidad.
- **Tests:** Siguen pasando; los mocks devuelven `TransactionStatus.SUCCESS` y el caso de uso llama `applyExternalResult` con ese valor.

Con esto, la entidad concentra la lógica de transición de estado y el resto del proyecto interactúa con ella a través de su API (`applyExternalResult` y getters).

---

## Uso del enum `TransactionStatus`

Este enum es la única fuente de verdad para los estados de una transacción en el dominio. Se usa en todo el flujo para evitar strings sueltos y tener tipado fuerte.

### Dónde se usa

| Lugar | Uso |
|-------|-----|
| **Entidad `Transaction`** | El estado interno `_status` y el getter `status` son de tipo `TransactionStatus`. El método `applyExternalResult` recibe y valida `TransactionStatus`. |
| **Request mapper** | Al crear la entidad desde el request se usa `TransactionStatus.PENDING` como estado inicial. |
| **Contrato externo `ExternalTransferResult`** | El campo `status` es `TransactionStatus`; el adaptador BREB devuelve ese tipo. |
| **Respuesta API `CreateTransferResponse`** | El campo `status` es `TransactionStatus`; en JSON se serializa como string (`"PENDING"`, `"SUCCESS"`, `"FAILED"`). |
| **Mapper de BREB `breb-response.mapper.ts`** | La respuesta del proveedor viene como string (p. ej. `"SUCCESS"`, `"COMPLETED"`). La función `mapStatusToTransactionStatus` normaliza: `SUCCESS`/`COMPLETED` → `TransactionStatus.SUCCESS`, `FAILED`/`ERROR`/`REJECTED` → `TransactionStatus.FAILED`, otro → `TransactionStatus.PENDING`. Así el dominio solo trabaja con el enum. |
| **Schema Mongoose `transaction.schema.ts`** | El campo `status` tiene `enum: Object.values(TransactionStatus)` y `type: String`, de modo que en base de datos solo se persisten valores válidos del enum. |
| **Registro de idempotencia `idempotency-record.ts`** | El campo `status` del registro es `TransactionStatus` y al crear un registro se usa `TransactionStatus.SUCCESS` (operación completada con éxito). |

### Resumen

- **Dominio:** Entidad, puertos y DTOs usan `TransactionStatus`.
- **Infraestructura:** El mapper de BREB traduce strings del proveedor al enum; el schema de Mongo restringe los valores al enum.
- **Consistencia:** No se usan strings literales para estados de transacción; todo pasa por el enum.

---

### Requerimiento 4: Persistencia real de transferencias

1. **Enum y validador** – Actualizar estados y validación de finalización.
2. **Puerto del repositorio** – Añadir `findById`.
3. **Implementación del repositorio** – Implementar `findById` y mapper documento → entidad.
4. **Use case GET** – Crear GetTransferByIdUseCase.
5. **DTO y mapper** – GetTransferResponse y función entidad → DTO.
6. **Controller** – GET /transfer/:id y manejo 404/200.
7. **Módulo** – Registrar use case e inyección en el controller.
8. **BREB mapper e idempotency** – Cambiar SUCCESS → CONFIRMED donde quieras unificar.

**Objetivo:** Guardar transferencias con estados (CREATED, SENT, CONFIRMED, FAILED, REVERSED) y exponer GET /transactions/transfer/:id para consultar estado. Se evalúa modelado de dominio, manejo de estados y consistencia.

**Estados de dominio:** Enum `TransactionStatus` ampliado con SENT, CONFIRMED, REVERSED (se mantiene SUCCESS para compatibilidad con BREB). Validador `validateFinalization`: solo CREATED puede finalizarse; resultados permitidos CONFIRMED, FAILED, REVERSED, SUCCESS.

**Qué se hizo (resumen):**

| Capa | Cambio |
|------|--------|
| **Dominio** | Enum con CREATED, SENT, SUCCESS, CONFIRMED, FAILED, REVERSED. Validador actualizado. Puerto `TransactionRepository` con `findById(id): Promise<Transaction \| null>`. Entidad `Transaction`: constructor acepta `finalizedAt` opcional para cargar desde BD. |
| **Aplicación** | `GetTransferByIdUseCase`: llama a `findById`; si null lanza NotFoundException, si no devuelve la entidad. |
| **Infraestructura** | `TransactionRepositoryImpl.findById`: busca por id, usa `TransactionMapper.toDomain(doc)` (incluye `finalizedAt`). `TransactionMapper.toDomain` pasa `doc.finalizedAt` al constructor. BREB mapper: SUCCESS/COMPLETED → CONFIRMED. Idempotency: registro con status CONFIRMED. Schema: mismo enum, acepta todos los estados. |
| **Entrypoints** | DTO `GetTransferResponse` (id, status, amount, currency, description, receiver, transactionDate, finalizedAt?). Mapper `mapTransactionToGetResponse`: entidad → DTO; `finalizedAt` solo cuando existe (undefined si no finalizada). Controller: GET /transfer/:id inyecta use case, devuelve 200 con DTO o 404 vía excepción. |
| **Módulo** | `GetTransferByIdUseCase` registrado como provider (inyecta TransactionRepository); controller inyecta el use case. |

**Consistencia:** Flujo POST sigue CREATED → applyExternalResult(CONFIRMED|FAILED) → save. GET devuelve el estado persistido; `finalizedAt` se carga desde BD cuando la entidad se reconstruye con `toDomain(doc)`.

---

### Requerimiento 5: correlacion ID

**Objetivo:** Rastrear una request de punta a punta con un único ID: header `x-correlation-id` en entrada y respuesta, en todos los logs (API, use cases, adapter, cliente HTTP, persistencia, idempotencia) y en las llamadas salientes a BREB.

**Qué se hizo (resumen):**

| Paso | Dónde | Qué |
|------|--------|-----|
| **1. Contexto** | `src/common/utils/correlation.util.ts` | `AsyncLocalStorage` con `runWithCorrelationId(id, fn)`, `getCorrelationId()` y `setCorrelationId(id)`. El id vive solo en el flujo asíncrono de cada request (no es cache; se “pierde” al terminar la request). |
| **2. Entrada HTTP** | `correlation-id.interceptor.ts` + `app.module.ts` | Interceptor global: lee o genera `x-correlation-id`, lo pone en la respuesta y ejecuta el handler dentro de `runWithCorrelationId(...)`. |
| **3. Logs** | Controller, use cases, breb.service, breb-http2.client, transaction.repository, redis-idempotency.service | En cada `logger.log` / `warn` / `error` se añade `correlationId=${getCorrelationId() ?? '-'}` para poder filtrar por id en consola o en el agregador de logs. |
| **4. Llamadas externas** | `breb-http2.client.ts` | En los headers de cada petición a BREB (POST/GET) se envía `'x-correlation-id': getCorrelationId() ?? ''` para que BREB pueda usar el mismo id en sus logs. |

**Resumen técnico:** Un solo id por request, propagado por contexto (AsyncLocalStorage) sin pasar parámetros; visible en logs y en el header hacia BREB. Worker (Bull, etc.): si se añade después, usar `runWithCorrelationId(job.correlationId ?? randomUUID(), () => ...)` al procesar el job.

## Requerimiento 6: Metricas

**Objetivo:** Exponer métricas operativas en memoria (contadores) y poder consultarlas por HTTP para observabilidad básica (transferencias creadas/fallidas, uso y errores de BREB).

**Qué se hizo (resumen):**

| Capa | Archivo(s) | Qué |
|------|------------|-----|
| **Dominio (puerto)** | `src/metrics/domain/providers/metrics.service.provider.ts` | Tipo `MetricsServicePort`: `increment(...)` y `getMetrics()` con cuatro claves: `transfer_created`, `transfer_failed`, `breb_calls`, `breb_errors`. |
| **Infraestructura** | `src/metrics/infrastructure/providers/http/metrics.service.ts` | Implementación en memoria: objeto con contadores que se incrementan con `increment`. |
| **Entrypoint** | `src/metrics/infrastructure/entrypoints/controller/metrics.controller.ts` | `GET /metrics` devuelve el objeto de métricas (sin prefijo de controller en la raíz de la app). |
| **Módulo** | `src/metrics/metrics.module.ts` | Registra el controller y el provider `'MetricsService'`; **exporta** `'MetricsService'` para inyectarlo en otros módulos. |
| **Transacciones** | `transaction.module.ts` | Importa `MetricsModule` e inyecta `'MetricsService'` en `CreateTransferUseCase`. |
| **Use case** | `create-transfer.use-case.ts` | Tras `save` exitoso → `increment('transfer_created')`. Si falla la llamada externa o la persistencia → `increment('transfer_failed')`. |
| **Adapter BREB** | `breb.service.ts` | Al iniciar `sendTransfer` / `getTransferById` → `increment('breb_calls')`. En el `catch` de cada método → `increment('breb_errors')`. |

**Objetivo del ajuste:** Persistencia:evitar perder contadores al reiniciar la API. Antes los contadores vivian solo en RAM; ahora se guardan en Redis.

**Qué se cambió:**

| Capa | Archivo(s) | Cambio |
|------|------------|--------|
| **Config Redis** | `src/config/redis/redis.module.ts` | Nuevo `RedisModule` que provee y exporta `REDIS_CLIENT` para reutilizar el mismo provider en varios modulos. |
| **Puerto de métricas** | `src/metrics/domain/providers/metrics.service.provider.ts` | `increment` y `getMetrics` pasan a ser asíncronos (`Promise`) porque Redis es I/O. |
| **Servicio de métricas** | `src/metrics/infrastructure/providers/http/metrics.service.ts` | Implementación cambia de objeto en memoria a hash de Redis. Usa `HINCRBY` para incrementar y `HGETALL` para leer. Clave configurable: `METRICS_REDIS_KEY` (default `metrics:counters`). |
| **Controller de métricas** | `src/metrics/infrastructure/entrypoints/controller/metrics.controller.ts` | `getMetrics()` ahora es `async` y responde lo que viene de Redis. |
| **MetricsModule** | `src/metrics/metrics.module.ts` | Importa `RedisModule` para inyectar `REDIS_CLIENT` en `MetricsService`. |
| **TransactionModule** | `src/transaction/transaction.module.ts` | Importa `RedisModule` y deja de declarar `RedisProvider` localmente. |
| **Lugares que incrementan métricas** | `create-transfer.use-case.ts`, `breb.service.ts` | Se agrega `await` a `metricsService.increment(...)` para respetar la firma asíncrona. |

**Comportamiento final:**

- Los contadores de `transfer_created`, `transfer_failed`, `breb_calls` y `breb_errors` sobreviven reinicios de la API (mientras Redis mantenga datos).
- `GET /metrics` devuelve el valor persistido acumulado en Redis.
- Si Redis falla temporalmente, el servicio registra `warn` y evita tumbar la operacion de negocio (best effort para métricas).

**Notas operativas:**

- Para resetear métricas manualmente, basta limpiar la clave Redis (`metrics:counters` o la definida en `METRICS_REDIS_KEY`).
- Esta solución ya da persistencia basica; si luego quieres observabilidad completa (históricos, dashboards y alertas), el siguiente paso natural es exportar a Prometheus/OpenTelemetry.
- **Vaciar Redis en local (idempotencia + métricas):** sin `redis-cli` en el host, usar el binario dentro del contenedor: `docker exec -it core_api_redis redis-cli FLUSHDB`. Alternativa: `brew install redis` y luego `redis-cli -h localhost -p 6379 ...`. Ver también **Requerimiento 9** para borrado selectivo.

---

## Requerimiento 7: Versionamiento del adapter BREB

### Dónde vive cada cosa (core vs “otro BREB”)

| Lugar | Rol |
|-------|-----|
| **Core API** (este repo) | Define el **puerto** `ExternalTransferService` (use cases solo conocen `sendTransfer` / `getTransferById`). Registra **qué adapter** usar según configuración. |
| **Infraestructura en core** | **Adapters** `BrebV1Adapter` y `BrebV2Adapter` + **cliente HTTP** `BrebHttp2ClientImpl` con **URL base distinta** por versión. Aquí se traduce el dominio a las rutas reales de cada versión. |
| **Otro servicio / mock BREB** | Es el proceso que **escucha** en `.../transfer` o `.../payments`. El core no debe duplicar su lógica de negocio; solo apuntar al host/path correcto. |

### Qué se hizo (resumen técnico)

| Pieza | Archivo(s) | Qué |
|------|------------|-----|
| **Puerto compartido** | `domain/providers/external-transfer.service.ts` | Sin cambio de contrato: el dominio sigue dependiendo del mismo tipo `ExternalTransferService`. |
| **Lógica compartida del adapter** | `http/breb/shared/breb-service.base.ts` | Clase abstracta `BrebAdapterBase` con `sendTransfer` y `getTransferById` (mapeo, métricas, logs). Evita duplicar cientos de líneas entre v1 y v2. |
| **Adapter v1** | `http/breb/v1/breb-v1.adapter.ts` | `BrebV1Adapter` extiende la base e inyecta el token **`BREB_HTTP2_CLIENT_V1`**. |
| **Adapter v2** | `http/breb/v2/breb-v2.adapter.ts` | `BrebV2Adapter` igual, pero inyecta **`BREB_HTTP2_CLIENT_V2`**. |
| **Cliente HTTP** | `http/breb/client/breb-http2.client.ts` | `BrebHttp2ClientImpl` recibe la **URL base en el constructor** (ya no fija una sola URL en el código). `resolveBrebV1BaseUrl` / `resolveBrebV2BaseUrl` leen env con defaults: v1 → `.../transfer`, v2 → `.../payments`. |
| **Tokens de inyección** | `http/breb/client/breb-http2.client.ts` | `BREB_HTTP2_CLIENT_V1` y `BREB_HTTP2_CLIENT_V2` (dos instancias del mismo cliente, distinta base URL). `BREB_HTTP2_CLIENT` queda como alias de v1 por compatibilidad. |
| **Mapper / circuit breaker / errores HTTP** | `http/breb/shared/breb-response.mapper.ts`, `breb-circuit-breaker.*`, `http-client-error.mapper.ts` | Código compartido por todas las versiones del cliente BREB. |
| **Selección en runtime** | `transaction.module.ts` | Se registran **ambos** adapters y **dos** clientes. El provider `'ExternalTransferService'` usa **factory**: lee `BREB_ADAPTER_VERSION` (`v1` o `v2`) y devuelve `BrebV1Adapter` o `BrebV2Adapter`. El use case sigue inyectando solo `'ExternalTransferService'`. |

### Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `BREB_ADAPTER_VERSION` | `v1` (default) o `v2`: qué adapter usa el core. |
| `BREB_V1_BASE_URL` | URL base de la API v1 (path típico `.../transfer`). Si no existe, se usa `BREB_BASE_URL` y luego el default local. |
| `BREB_V2_BASE_URL` | URL base de la API v2 (path típico `.../payments`). Default: `http://localhost:3001/payments`. |
| `BREB_BASE_URL` | Compatibilidad: fallback para v1 si no defines `BREB_V1_BASE_URL`. |

### Desacoplamiento (cómo se demuestra)

- **Dominio / aplicación:** solo conocen `ExternalTransferService`; no saben si existe transfer o payments.
- **Infraestructura:** la versión es un **detalle de despliegue** (env + factory), no un `if` en el use case.
- **Extensión futura:** una v3 sería otro adapter + otro token + otra URL; el mapeo de respuesta sigue centralizado en `breb/shared/breb-response.mapper.ts` mientras el contrato JSON sea compatible.

### Estructura de carpetas (infra `http/breb`)

Todo lo relacionado con BREB queda bajo `src/transaction/infrastructure/providers/http/breb/`:

| Carpeta | Contenido |
|---------|-----------|
| **`breb/client/`** | Cliente HTTP/2 (`breb-http2.client.ts`): tokens `BREB_HTTP2_CLIENT_V1` / `V2`, `BrebHttp2ClientImpl`, URLs `resolveBrebV*`. |
| **`breb/shared/`** | Base clase `BrebAdapterBase` (`breb-service.base.ts`), mapper de respuesta, circuit breaker, mapeo de errores HTTP. |
| **`breb/v1/`** | Solo el adapter **`breb-v1.adapter.ts`** (`BrebV1Adapter`). |
| **`breb/v2/`** | Solo el adapter **`breb-v2.adapter.ts`** (`BrebV2Adapter`). |

Fuera de `breb/` siguen otros recursos HTTP genéricos, por ejemplo **`http/interceptors/`** (correlation id).

### Mock / servicio BREB (fuera del core)

Para probar v2 en local, el mock BREB debe exponer las mismas operaciones (POST/GET) bajo **`/payments`** con el mismo cuerpo/respuesta esperado por el mapper, o el mock debe adaptarse. El core solo cambia el **prefijo** de la URL; no implementa la lógica del otro servicio.

---

## Requerimiento 8: Tests reales (cobertura e integración BREB)

**Objetivo del requerimiento:** (1) Mantener **al menos ~80% de cobertura** en tests unitarios sobre **casos de uso** de transacciones y la **capa adapter BREB** (v1, v2 y la base compartida). (2) Tener **un test de integración** que ejecute el flujo **crear transferencia → llamada HTTP/2 real a un “mock BREB”** (servidor embebido en el test que habla el mismo contrato que BREB), sin sustituir el cliente HTTP por mocks.

### Desglose

| Pieza | Qué significa | Cómo se cumple en el repo |
|--------|----------------|---------------------------|
| **Unit tests — use cases** | Cobertura de líneas/ramas/funciones en `CreateTransferUseCase` y `GetTransferByIdUseCase` (lógica de aplicación aislada con repos y `ExternalTransferService` mockeados). | Specs en `test/transaction/application/use-cases/*.spec.ts`; casos felices y de error (fallo externo, fallo persistencia, re-lanzamiento de `HttpException`). |
| **Unit tests — adapters** | Cobertura en los adapters HTTP BREB: clases finas en `v1/` y `v2/` más la lógica compartida en `breb-service.base.ts` (`sendTransfer`, `getTransferById`, métricas y errores). | `test/transaction/infrastructure/providers/http/breb/v1/breb-v1.adapter.spec.ts`, `.../v2/breb-v2.adapter.spec.ts`. |
| **Cobertura global (`All files`)** | El informe de Jest incluye todo `src/` salvo entradas puramente de cableado. | `collectCoverageFrom` excluye `src/main.ts` y `src/**/*.module.ts` (bootstrap y módulos Nest sin lógica testeable unitaria); el resto se cubre con specs alineados a `src/` (config, métricas, persistencia, BREB shared, interceptor, etc.). Con las suites actuales la línea global suele situarse **≥ ~80%** en líneas. |
| **Umbral 80% (rutas críticas)** | Jest falla `npm run test:cov` si esas rutas bajan del mínimo acordado. | `coverageThreshold` en `package.json` para `src/transaction/application/use-cases/**/*.ts`, `.../breb/v1/**/*.ts`, `.../breb/v2/**/*.ts` y `.../breb/shared/breb-service.base.ts`. |
| **Integración transfer → mock BREB** | Un test que atraviese caso de uso + adapter + **cliente `BrebHttp2ClientImpl`** contra un proceso que responde como BREB. | `test/integration/transfer-breb.integration-spec.ts`: levanta un `http2.createServer` local en puerto aleatorio, responde `POST /transfer` con JSON válido para el mapper; ejecuta `CreateTransferUseCase` con `BrebV1Adapter` y repositorio en memoria. No hace falta levantar el mock BREB externo para CI; el “mock” es el servidor HTTP/2 del propio test. |

### Estructura de `test/` (alineada a `src/`)

Los unit tests viven bajo `test/` siguiendo el mismo árbol que el código de producción: por ejemplo `test/transaction/application/use-cases/`, `test/transaction/infrastructure/providers/http/breb/...`, `test/config/mongo/`, `test/metrics/infrastructure/...`. Lo compartido transversal sigue en `test/common/`. E2E e integración permanecen en `test/*.e2e-spec.ts`, `test/transaction/infrastructure/idempotency/*.e2e-spec.ts` y `test/integration/*.integration-spec.ts`.

### Comandos

- **Unit tests + cobertura (con umbrales):** `npm run test:cov`
- **E2E (HTTP sobre app de prueba):** `npm run test:e2e` (config `test/jest-e2e.json`; archivos `*.e2e-spec.ts`)
- **Solo integración BREB:** `npm run test:integration` (config `test/jest-integration.json`; los `*.integration-spec.ts` están excluidos del `jest` unitario por `testPathIgnorePatterns`).

Para ejecutar **las tres tandas en secuencia** (lo habitual antes de un PR o una demo):

```bash
npm run test:cov && npm run test:e2e && npm run test:integration
```

Métrica	Porcentaje
Statements (% Stmts)	81,39%
Branches (% Branch)	73,31%
Functions (% Funcs)	67,44%
Lines (% Lines)	82,38%

Si los tres comandos terminan con código de salida **0** y ves **PASS** en cada suite, **no hay errores de prueba**: todo lo que fallaría aparecería como **FAIL** y Jest devolvería un código distinto de cero.

### Cómo leer la salida (qué es cada cosa)

| Qué ves en consola | Qué significa |
|--------------------|----------------|
| **`PASS test/.../*.spec.ts`** | Ese archivo de tests **pasó**. El orden de ejecución puede variar; lo importante es el resumen final de cada comando. |
| **`Test Suites: N passed`** / **`Tests: M passed`** | Resumen del comando actual: **N** archivos de test y **M** casos ejecutados con éxito. Si hubiera fallos, aparecería `failed` y el detalle del caso. |
| **`[Nest] ... ERROR`** | Mensaje del **logger de Nest** dentro del código bajo prueba. En muchos specs es **esperado** (por ejemplo el adapter BREB que prueba respuestas inválidas o red caída). **No** indica que Jest haya fallado si la línea anterior o posterior dice **PASS**. |
| **`[Nest] ... WARN`** | Igual: avisos de lógica (idempotencia conflict, métricas con Redis mockeado que falla a propósito, etc.). |
| **`[Nest] ... DEBUG` / `LOG`** | Trazas normales del flujo (casos de uso, repositorio, idempotencia). |
| **Tabla `% Stmts` / `% Lines` / `All files`** | Informe de **cobertura** solo en `npm run test:cov`. Indica qué porcentaje del código incluido en `collectCoverageFrom` se ejecutó al menos una vez. Valores bajos en **`breb-http2.client.ts`** en unitarios son normales: ese cliente se ejerce en el **test de integración** HTTP/2, no en todos los unit tests. |
| **`Running coverage on untested files...`** | Mensaje de Istanbul/Jest mientras termina de instrumentar; a veces se mezcla con logs de tests que aún escriben en consola. |
| **`Force exiting Jest: Have you considered using --detectOpenHandles`** | **Aviso** de Jest porque en `jest-e2e.json` e `jest-integration.json` está `forceExit: true`. No es un fallo; solo sugiere depurar handles abiertos si algún día quisieras quitar `forceExit`. |

### Preguntas frecuentes (cómo explicarlo en una revisión)

- **¿Cómo hicieron las pruebas?** — Unitarios con Jest + `@nestjs/testing` (mocks de repositorio, BREB, Redis, métricas), e2e con `supertest` sobre una app Nest mínima en memoria, e integración con un servidor HTTP/2 embebido que simula BREB.
- **¿Eso que dice ERROR es que algo está mal?** — No, si el test **PASS**: son logs del dominio simulando errores (BREB inválido, conflicto de idempotencia, etc.).
- **¿Hay errores reales?** — Solo si aparece **FAIL**, un stack trace de expectativa (`Expected ... Received ...`) o el comando termina con **exit code ≠ 0**.
- **¿Por qué “All files” ~80% y no 100%?** — Se excluyen `main` y módulos `.module.ts` del cómputo; además no todo el código tiene el mismo peso (p. ej. cliente HTTP/2 muy cubierto en integración). Los **umbrales obligatorios** están en use cases y adapters BREB vía `coverageThreshold`.

---

## Requerimiento 9: Concurrencia (pruebas y lecciones operativas)

**Contexto:** Las pruebas de concurrencia aquí son principalmente **manuales o con scripts** (no sustituyen los tests automatizados del Requerimiento 8). Sirven para ver comportamiento bajo **muchas peticiones en paralelo** hacia `POST /transactions/transfer`, con Redis, Mongo y BREB reales o mock.

### Qué pruebas puedes hacer

| Prueba | Qué configurar | Qué observar |
|--------|----------------|--------------|
| **Carga “feliz”** | N peticiones en paralelo (p. ej. 100) con **`Idempotency-Key` distinta por petición** (`key-${i}` o `key-${Date.now()}-${i}` para no chocar con Redis de corridas anteriores) y **`transaction.id` distinto por petición** (`tx-${i}`). | `Resumen HTTP` con muchos **201**; en Mongo N documentos en `transactions`; `GET /metrics` con `transfer_created` y `breb_calls` coherentes. |
| **Mismo id hacia BREB** | Varias peticiones concurrentes con el **mismo `transaction.id`** (mismo body salvo que el mock/BREB rechace duplicados). | El upstream puede responder **409** (conflicto / duplicado). La API lo expone como **502** con mensaje tipo `external service rejected request (409)`. No confundir con idempotencia de la API. |
| **Idempotencia: misma key, mismo body** | Dos ráfagas o dos envíos con la **misma** `Idempotency-Key` y **el mismo** JSON. | Segunda respuesta debe coincidir con la primera; el flujo de negocio no debe ejecutarse dos veces (comprobar logs o contadores). |
| **Idempotencia: misma key, distinto body** | Misma key en peticiones con **cuerpos distintos** (p. ej. mismo header, distinto `transaction.id`). | **409 Conflict** en la API: `Idempotency-Key reused with different payload`. |
| **Redis vs Mongo** | Borrar solo la colección `transactions` en Mongo y repetir peticiones con las **mismas** keys de idempotencia que ya usaste. | Puede “parecer éxito” (201 cacheado) **sin** nuevos inserts: la respuesta sale de **Redis**, no se vuelve a persistir. Para un estado limpio, borrar claves `idempotency:*` o usar keys nuevas por corrida. |
| **Circuit breaker BREB** | Muchos fallos seguidos contra BREB (timeouts, 409 masivos, etc.). | Tras superar el umbral configurado (`BREB_CIRCUIT_*`), respuestas **500** con error tipo **Breaker is open**: el core deja de llamar al upstream durante el tiempo de apertura. |
| **Herramientas** | Script `scripts/concurrency-test.ts` (`npm run test:concurrency`): resumen HTTP, JSON de salida y `CONCURRENCY_VERBOSE=1` para volcar en consola. | Alternativas: autocannon, k6, Apache Bench; subir carga de a poco (10 → 50 → 100). |

### Lo más importante que conviene tener claro (antes de exigir concurrencia “de verdad”)

1. **`Promise.allSettled` / `fetch` “fulfilled” no es éxito de negocio.** Hay que mirar **`status` HTTP** (201 vs 409 vs 502 vs 500) y el cuerpo; por eso el script registra `res.status` y el JSON de error.
2. **Idempotencia vive en Redis** (`IDEMPOTENCY_KEY_PREFIX`, por defecto claves `idempotency:<key>`). **Vaciar Mongo no borra** respuestas cacheadas; las métricas están en otro hash (`metrics:counters` o `METRICS_REDIS_KEY`).
3. **409 de idempotencia (API)** vs **409 del BREB (upstream):** el primero es conflicto de **misma key + distinto payload** en el controller. El segundo llega como fallo del cliente HTTP y el mapper traduce **4xx del upstream a 502 Bad Gateway** para el cliente del core (`http-client-error.mapper.ts`).
4. **Mismo `transaction.id` en muchas peticiones paralelas** puede disparar **409 en BREB** y luego **apertura del circuit breaker**; no es un fallo del script de concurrencia, es presión sobre las reglas del mock/servicio externo.
5. **Reset local rápido:** `docker exec -it core_api_redis redis-cli FLUSHDB` vacía idempotencia y métricas en esa base Redis; para solo métricas, `DEL metrics:counters`; para solo idempotencia, borrar patrones `idempotency:*` (ver notas del Requerimiento 6 en este mismo documento).

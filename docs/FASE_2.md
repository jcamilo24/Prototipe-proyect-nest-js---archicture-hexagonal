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

#### 4. Ajuste para respetar mejor el patrón hexagonal

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

- **Dónde:** `src/config/mongo.config.ts` — función `getMongoUri(ConfigService)`.
- **Comportamiento:** En desarrollo usa `MONGO_URI` o default `mongodb://localhost:27017/practice-project`. En **producción** (`NODE_ENV=production`) exige `MONGO_URI`; si falta o está vacío, lanza error al arrancar (no se usa localhost por defecto).
- **App:** `app.module.ts` usa `MongooseModule.forRootAsync` inyectando `ConfigService` y llamando a `getMongoUri(configService)`.

---

### Errores del use case en la capa de aplicación

- **Antes:** `common/errors/use-case-error.mapper.ts` (compartido).
- **Ahora:** `transaction/application/errors/use-case-error.helper.ts` — función `throwUseCaseError(err, context)`: re-lanza `HttpException` y envuelve el resto en `InternalServerErrorException` con contexto.
- **Motivo:** La lógica de “envolver errores con contexto” es de la capa de aplicación; el use case no debe depender de mappers de HTTP (esos los usan los adaptadores).

---

### E2E de idempotencia

- **Ubicación:** `test/infrastructure/idempotency/transaction.e2e-spec.ts`.
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


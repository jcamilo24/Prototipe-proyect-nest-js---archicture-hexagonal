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


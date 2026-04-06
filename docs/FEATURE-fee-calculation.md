# HDU — Cálculo de comisión en transferencias

## Historia de usuario

**Como** sistema de transferencias,  
**quiero** que cada transferencia calcule y registre su propia comisión operativa,  
**para que** el resultado de cada operación refleje el costo real aplicado según la moneda.

---

## Contexto

Toda transferencia tiene un costo operativo que varía según la moneda. Este costo debe
calcularse en el momento de procesar la transferencia, quedar registrado en la transacción
y ser visible en el resultado de la operación.

---

## Criterios de aceptación

1. Al procesar una transferencia en `COP`, se le aplica una comisión del **1%** sobre el monto.
2. Al procesar una transferencia en `USD`, se le aplica una comisión del **2%** sobre el monto.
3. Si la moneda no es `COP` ni `USD`, la operación es rechazada con un error claro
   **antes** de intentar cualquier llamada al servicio externo.
4. La comisión queda registrada en la transacción que se persiste.
5. El resultado de `CreateTransferUseCase` incluye la comisión aplicada.
6. La comisión se aplica **antes** de enviar la transferencia al servicio externo.

---

## Notas

### ¿Por qué porcentaje en USD y no tarifa fija?

Una tarifa fija (ej. $5 USD) introduce un caso inválido: si el monto es $2 USD, el fee
superaría el monto de la transferencia. Con un porcentaje, el fee siempre es proporcional
y no puede superar el monto, sin necesidad de agregar validaciones adicionales.

### Sugerencia arquitectónica

> Esta sección es una guía de reflexión, no una solución prescrita.

Pregúntate: ¿de qué datos depende el cálculo del fee?

La respuesta es `currency` y `amount` — ambos son propiedades de la entidad `Transaction`.
Cuando una regla de negocio opera **únicamente** sobre el estado propio de una entidad,
la arquitectura hexagonal y los principios de DDD indican que esa regla **pertenece a la entidad**.

Esto evita el **Anemic Domain Model**: una entidad que solo tiene datos pero ninguna lógica,
y delega todas las reglas a capas superiores.

Observa cómo `applyExternalResult()` ya sigue este patrón: la entidad recibe un dato
externo y aplica sus propias reglas sobre él. ¿Podría `applyFee()` seguir el mismo enfoque,
sin siquiera necesitar argumentos, calculando desde su propio estado?

El use case debe **orquestar**, no **decidir**. Si el use case contiene
`if (currency === 'COP')`, está tomando una decisión de negocio que no le corresponde.

# Practice Project – API de transferencias

API principal (Core) del flujo de transferencias: recibe solicitudes, orquesta el caso de uso, persiste en MongoDB y delega el envío externo en la breb-adapter API (o mock).

- **Stack:** NestJS, TypeScript, MongoDB (Mongoose), Axios.
- **Arquitectura:** hexagonal (dominio, aplicación, infraestructura con entrypoints y providers).

---

## Requisitos previos

Antes de instalar dependencias y correr el proyecto necesitas:

| Requisito        | Descripción |
|------------------|-------------|
| **Node.js**     | v18 o superior (recomendado LTS). [Descargar](https://nodejs.org/). |
| **npm**         | Viene con Node. Para comprobar: `node -v` y `npm -v`. |
| **MongoDB**     | Base de datos. Debe estar instalado y en ejecución en `localhost:27017` (o la URI que configures). |

### Instalar MongoDB (si no lo tienes)

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongo-practice mongo:latest
```

**Windows / otras opciones:** [Documentación oficial MongoDB](https://www.mongodb.com/docs/manual/installation/).

---

## Instalación

1. Clonar o abrir el proyecto y entrar en la carpeta:
   ```bash
   cd practice-project
   ```

2. Instalar dependencias (esto instala Nest, Mongoose, Axios, etc.; no hace falta instalar librerías a mano):
   ```bash
   npm install
   ```

3. Configurar variables de entorno (opcional pero recomendado):
   ```bash
   cp .env.example .env
   ```
   Luego edita `.env` y ajusta si es necesario (ver más abajo).

---

## Variables de entorno

Copia `.env.example` a `.env` y, si quieres cambiar los valores por defecto, define:

| Variable        | Descripción | Por defecto |
|-----------------|-------------|-------------|
| `MONGO_URI`     | URI de conexión a MongoDB. | `mongodb://localhost:27017/practice-project` |
| `BREB_BASE_URL`| URL de la breb-adapter API (segundo servicio) que recibe la transferencia en formato puntored. | `http://localhost:3001/transfer` |

Ejemplo `.env` para desarrollo local con segunda API en el puerto 3001:
```env
MONGO_URI=mongodb://localhost:27017/practice-project
BREB_BASE_URL=http://localhost:3001/transfer
```

---

## Cómo correr el proyecto

### 1. Asegurar que MongoDB esté en ejecución

- Si usas servicio de sistema: `brew services start mongodb-community` (macOS) o el equivalente en tu SO.
- Si usas Docker: el contenedor debe estar levantado en el puerto 27017.

### 2. (Opcional) Levantar la breb-adapter API

Si el flujo completo usa la **segunda API** (breb-adapter) en otro proyecto Nest:

- En la carpeta de ese proyecto: `npm install` y `npm run start` (o el puerto que uses, p. ej. 3001).
- La URL que pongas en `BREB_BASE_URL` debe coincidir (ej. `http://localhost:3001/transfer`).

Si en su lugar usas un **mock** (script Node o Postman Mock), no hace falta levantar la segunda API; solo que la URL en `BREB_BASE_URL` apunte a ese mock.

### 3. Levantar esta API (Core)

```bash
# Desarrollo
npm run start

# Con recarga al cambiar código
npm run start:dev

# Producción (después de compilar)
npm run build
npm run start:prod
```

Por defecto la API queda en **http://localhost:3000**.

---

## Probar el flujo

**Endpoint:** `POST http://localhost:3000/transactions/transfer`

**Headers:** `Content-Type: application/json`

**Body de ejemplo (formato del engine):**
```json
{
  "transaction": {
    "id": "tx-001",
    "amount": 111000,
    "moneda": "USD",
    "descripcion": "Recarga celular",
    "receptor": {
      "documento": "3006985758",
      "tipoDocumento": "CC",
      "nombre": "MI EMPRESA S.A.S",
      "cuenta": "323232",
      "tipoCuenta": "Ahorros"
    }
  }
}
```

Puedes usar Postman, Insomnia o `curl`:
```bash
curl -X POST http://localhost:3000/transactions/transfer \
  -H "Content-Type: application/json" \
  -d '{"transaction":{"id":"tx-001","amount":111000,"moneda":"USD","descripcion":"Recarga","receptor":{"documento":"3006985758","tipoDocumento":"CC","nombre":"MI EMPRESA","cuenta":"323232","tipoCuenta":"Ahorros"}}}'
```

---

## Tests

- **Unitarios:** `npm run test`
- **Cobertura:** `npm run test:cov`
- **End-to-end:** `npm run test:e2e`

Los e2e del flujo de transferencia usan mocks (no requieren MongoDB ni la segunda API en ejecución).

---

## Scripts útiles

| Comando        | Descripción |
|----------------|-------------|
| `npm run start`      | Inicia la API en modo desarrollo. |
| `npm run start:dev`  | Inicia con watch (recarga al guardar). |
| `npm run build`      | Compila a JavaScript en `dist/`. |
| `npm run test`       | Ejecuta tests unitarios. |
| `npm run test:e2e`   | Ejecuta tests e2e. |
| `npm run test:cov`   | Tests con reporte de cobertura. |
| `npm run lint`       | Ejecuta ESLint. |

---

## Resumen: qué necesitas para que funcione

1. **Node.js** (v18+) y **npm** → `npm install`.
2. **MongoDB** instalado y corriendo (local o Docker).
3. **Archivo `.env`** (opcional) con `MONGO_URI` y `BREB_BASE_URL` si usas valores distintos a los por defecto.
4. **breb-adapter API** (o mock) levantada y accesible en la URL que tengas en `BREB_BASE_URL`, si quieres que el flujo de transferencia llame a un servicio externo real o simulado.

No hace falta descargar librerías a mano: todas las dependencias del proyecto (Nest, Mongoose, Axios, etc.) se instalan con `npm install` según `package.json`.

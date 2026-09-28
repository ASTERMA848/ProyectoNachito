# Agencia de Cambio — Sistema de Gestión Operativa (Liquid Glass UI)

Sistema integral de gestión de operaciones cambiarias, cuentas corrientes, tesorería, liquidaciones y auditoría desarrollado con Next.js 14, React 18, Tailwind/Liquid Glass UI y Prisma (SQLite).

---

## 🚀 Guía de Despliegue Local (en cualquier PC)

Sigue estos sencillos pasos para instalar y ejecutar el proyecto desde cero en otra computadora:

### 1. Requisitos Previos
- **Node.js**: v18.x o v20.x superior ([Descargar Node.js](https://nodejs.org/))
- **Git**: Instalar Git ([Descargar Git](https://git-scm.com/))

---

### 2. Clonar el Repositorio
Abre la terminal en la carpeta deseada e instala el proyecto:

```bash
git clone https://github.com/ASTERMA848/ProyectoNachito.git
cd ProyectoNachito
```

---

### 3. Instalar Dependencias
Instala los paquetes necesarios del proyecto:

```bash
npm install
```

---

### 4. Configurar Variables de Entorno
Copia el archivo de ejemplo `.env.example` para crear tu archivo `.env` local:

**En Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**En Mac / Linux / Bash:**
```bash
cp .env.example .env
```

*(El archivo `.env` ya viene preconfigurado con SQLite `file:./dev.db` para desarrollo local).*

---

### 5. Crear la Base de Datos e Inicializar Datos
Ejecuta el comando automatizado de base de datos que crea las tablas e inserta el usuario administrador y las monedas base (`USD`, `EUR`, `ARS`, `BRL`, `USDT`):

```bash
npm run db:setup
```

> **Credenciales de Acceso Inicial:**
> - **Usuario:** `admin`
> - **Contraseña:** `admin` *(Se recomienda cambiar la clave en la sección Mi Perfil o mediante el script `node migrate-admin-password.js "NUEVA_CLAVE"`)*.

---

### 6. Iniciar el Servidor en Desarrollo
Levanta la aplicación localmente:

```bash
npm run dev
```

Abre tu navegador e ingresa a: **`http://localhost:3000`**

---

## 🛠️ Comandos Útiles

- **Iniciar Servidor de Desarrollo:** `npm run dev`
- **Reconfigurar / Reiniciar Base de Datos:** `npm run db:setup`
- **Panel Visual de la Base de Datos (Prisma Studio):** `npx prisma studio`
- **Cambiar Clave de Administrador por Terminal:** `node migrate-admin-password.js "NUEVA_CLAVE"`
- **Compilar para Producción:** `npm run build`
- **Ejecutar en Modo Producción:** `npm run start`

---

## 🔒 Estructura y Tecnologías
- **Frontend / Backend:** Next.js 14 (App Router)
- **UI Framework:** Liquefy UI / Liquid Glass Design System
- **Base de Datos:** SQLite con Prisma ORM
- **Seguridad:** Autenticación mediante Sesión HTTP-Only y Hashing Bcrypt

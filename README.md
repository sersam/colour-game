# Colour Game - Monorepo

Un juego interactivo de colores construido como un monorepo con arquitectura cliente-servidor.

## 📁 Estructura del Proyecto

```
colour-game/
├── client/          # Aplicación frontend
├── server/          # Aplicación backend
├── README.md        # Este archivo
└── .github/
    └── workflows/   # Configuración de CI/CD
```

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 16+ y npm
- Git

### Instalación y Ejecución

1. **Clonar el repositorio**
   ```bash
   git clone <repositorio-url>
   cd colour-game
   ```

2. **Instalar dependencias en ambas carpetas**
   ```bash
   # Frontend
   cd client
   npm install
   cd ..

   # Backend
   cd server
   npm install
   cd ..
   ```

3. **Ejecutar en desarrollo**
   ```bash
   # Desde la raíz, ejecuta el servidor y cliente en paralelo
   # Terminal 1: Backend
   cd server
   npm run dev

   # Terminal 2: Frontend
   cd client
   npm run dev
   ```

4. **Construir para producción**
   ```bash
   # Frontend
   cd client
   npm run build

   # Backend
   cd server
   npm run build
   ```

## 📋 Scripts Disponibles

### Client
- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run lint` - Ejecuta linting del código
- `npm test` - Ejecuta las pruebas

### Server
- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run lint` - Ejecuta linting del código
- `npm test` - Ejecuta las pruebas

## 🔄 Flujo de Trabajo

1. Crea una rama local desde `main`
   ```bash
   git checkout -b feature/nombre-de-la-feature
   ```

2. Realiza tus cambios y haz commit
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"
   ```

3. Sube tu rama
   ```bash
   git push origin feature/nombre-de-la-feature
   ```

4. Abre un Pull Request en GitHub
5. El CI ejecutará automáticamente los linters
6. Una vez aprobado, realiza el merge a `main`

## 🛡️ Protección de Rama

La rama `main` está configurada con las siguientes protecciones:
- ✅ Requiere revisión de Pull Request
- ✅ Requiere que todas las comprobaciones de CI pasen
- ✅ Requiere que las historias estén actualizadas

## 🔨 CI/CD

Se utiliza **GitHub Actions** para ejecutar automáticamente:
- **Linting**: Valida el código con ESLint
- **Tests**: Ejecuta la suite de pruebas (cuando esté configurada)

Los workflows se encuentran en `.github/workflows/`

## 📝 Contribuir

1. Asegúrate de que tu código cumple con los estándares de linting
2. Escribe pruebas unitarias si es posible
3. Mantén la estructura del monorepo organizada
4. Sigue las convenciones de commit

## 📄 Licencia

[Especificar licencia]

## 👥 Equipo

[Información del equipo o contacto]

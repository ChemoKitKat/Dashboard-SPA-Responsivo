# CloudPulse — Dashboard SPA Responsivo

Plataforma web SPA de monitoreo de servidores e instancias cloud desarrollada con **HTML5 semántico, CSS3 nativo (CSS Grid, Bento Grid, Flexbox, Custom Properties) y JavaScript Vanilla**.

## Arquitectura e Implementación
- **Estrategia Mobile-First:** Reglas base para dispositivos móviles con expansión progresiva en `768px` y `1024px`.
- **Tres Zonas Funcionales:**
  - *Zona 1 (Navegación):* Header fijo con Breadcrumbs + indicador de origen y Sidebar retráctil/persistente.
  - *Zona 2 (Contenido Dinámico):* Bento Grid de métricas, gráfica nativa, búsqueda, filtro y paginación.
  - *Zona 3 (Acciones Contextuales y Críticas):* Drawer deslizante de configuración y Modal accesible con confirmación destructiva.
- **5 Estados + Modo Oscuro:** Estados `Default`, `Hover`, `Focus`, `Disabled` y `Loading` con bloqueo de doble envío y soporte `prefers-color-scheme` + selector manual.

## Ejecución Local
Abre `index.html` directamente en cualquier navegador moderno o sírvelo con Live Server / `python3 -m http.server 8080`.
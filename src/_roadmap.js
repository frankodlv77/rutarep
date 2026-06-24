/*
 * ══════════════════════════════════════════════════════════════════
 * ROADMAP — PLAY STORE / APP STORE
 * Sprint 1 (seguridad + UX base) — COMPLETADO
 *   ✅ Error boundary global (src/components/ErrorBoundary.jsx)
 *   ✅ Recuperación de contraseña con flujo completo (src/screens/PasswordResetScreen.jsx)
 *   ✅ Auth JWT en /api/push y /api/subscribe
 * ══════════════════════════════════════════════════════════════════
 *
 * SPRINT 2 — Legal (prerequisito para ambas stores)
 * ─────────────────────────────────────────────────
 * 1. Privacy Policy
 *    - Crear src/screens/PrivacyScreen.jsx
 *    - Ruta /privacy (o modal desde Perfil y desde LoginScreen)
 *    - Debe incluir: qué datos se colectan (email, ubicación GPS, fotos),
 *      con quién se comparten (Supabase, Vercel), cómo se eliminan.
 *    - Agregar enlace en LoginScreen al lado del checkbox de T&C.
 *    - URL pública requerida: https://rutarep.vercel.app/privacy
 *
 * 2. Terms & Conditions
 *    - Ya existe TerminosScreen.jsx — revisar que incluya:
 *      uso aceptable, limitación de responsabilidad, jurisdicción.
 *    - URL pública requerida: https://rutarep.vercel.app/terms
 *    - Verificar que el checkbox en registro enlace a ambas URLs.
 *
 * 3. Eliminar cuenta desde UI de Perfil
 *    - La lógica deleteAccount() ya existe en useStore.js
 *    - Agregar botón "Eliminar mi cuenta" en PerfilScreen con ConfirmModal
 *    - OBLIGATORIO para Google Play desde 2023
 *    - Debe eliminar: perfil, clientes, historial, sesion_activa,
 *      rutas, ubicaciones, push_subscriptions, mensajes del equipo
 *
 * 4. Privacy Policy enlazada desde el registro
 *    - En LoginScreen modo 'register', el checkbox de T&C debe decir:
 *      "Acepto los Términos y Condiciones y la Política de Privacidad"
 *    - Ambos textos deben ser links clickeables.
 *
 * ══════════════════════════════════════════════════════════════════
 *
 * SPRINT 3 — Play Store (Android) via TWA
 * ─────────────────────────────────────────
 * 1. Ícono maskable
 *    - Crear icon-512-maskable.png con padding ~20% (zona segura Android)
 *    - Agregar en vite.config.js manifest.icons:
 *      { src: 'icon-512-maskable.png', sizes: '512x512',
 *        type: 'image/png', purpose: 'maskable' }
 *
 * 2. Completar el Web App Manifest
 *    - Agregar en vite.config.js manifest:
 *      lang: 'es',
 *      categories: ['productivity', 'business'],
 *      screenshots: [
 *        { src: 'screenshot-1.png', sizes: '390x844', type: 'image/png',
 *          form_factor: 'narrow', label: 'Pantalla de inicio' },
 *        { src: 'screenshot-2.png', sizes: '390x844', type: 'image/png',
 *          form_factor: 'narrow', label: 'Ruta del día' },
 *      ]
 *    - Crear screenshots y guardarlos en /public/
 *
 * 3. Digital Asset Links (TWA)
 *    - Crear public/.well-known/assetlinks.json
 *    - Contenido se genera con Bubblewrap o Google Play Console
 *    - Vincula el APK firmado con el dominio rutarep.vercel.app
 *    - Configurar Vercel para servir /.well-known/ sin redirect
 *      (agregar en vercel.json: headers para /.well-known/*)
 *
 * 4. Generar APK con Bubblewrap
 *    - Instalar: npm i -g @bubblewrap/cli
 *    - Ejecutar: bubblewrap init --manifest https://rutarep.vercel.app/manifest.webmanifest
 *    - bubblewrap build → genera .aab para Play Store
 *    - Requiere: JDK 11+, Android SDK, cuenta Google Play Developer ($25)
 *
 * 5. Lighthouse audit antes de subir
 *    - Score PWA debe ser 100 (o muy cercano)
 *    - Verificar: HTTPS, manifest válido, SW funcionando, íconos
 *    - Correr: npx lighthouse https://rutarep.vercel.app --view
 *
 * 6. Play Store listing
 *    - Título: "RutaRep – Gestión de entregas"
 *    - Categoría: Productividad → Negocios
 *    - Screenshots: mínimo 2 (portrait 9:16)
 *    - Feature graphic: 1024x500px
 *    - Content rating: PEGI 3 / Everyone
 *    - Privacy Policy URL: https://rutarep.vercel.app/privacy
 *
 * ── iOS / App Store (después de validar en Android) ──────────────
 * - Requiere Capacitor: npm install @capacitor/core @capacitor/ios
 * - npx cap add ios → genera proyecto Xcode
 * - Apple Developer Program: $99/año
 * - Privacy Nutrition Labels: declarar location, email, usage data
 * - Mínimo iOS: 16.0 (para Web Push support en PWA)
 * ══════════════════════════════════════════════════════════════════
 */

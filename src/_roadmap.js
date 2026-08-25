/*
 * ══════════════════════════════════════════════════════════════════
 * ROADMAP — PLAY STORE / APP STORE
 * ══════════════════════════════════════════════════════════════════
 *
 * SPRINT 1 — COMPLETADO ✅
 *   ✅ Error boundary global (src/components/ErrorBoundary.jsx)
 *   ✅ Recuperación de contraseña (src/screens/PasswordResetScreen.jsx)
 *   ✅ Auth JWT en /api/push y /api/subscribe
 *
 * SPRINT 2 — COMPLETADO ✅
 *   ✅ Privacy Policy pública en /privacy.html
 *   ✅ Terms of Service público en /terms.html
 *   ✅ Links legales en LoginScreen (checkbox registro) y PerfilScreen
 *   ✅ Eliminar cuenta desde PerfilScreen — "Zona de peligro" con doble
 *      confirmación: primer modal genérico + segundo requiere escribir "BORRAR"
 *      (src/modals/ConfirmModal.jsx soporta prop confirmText)
 *
 * SPRINT 3 — COMPLETADO ✅
 *   ✅ Íconos maskable y PWA manifest (vite.config.js)
 *   ✅ Digital Asset Links (public/.well-known/assetlinks.json)
 *        package_name: app.vercel.vorarep.twa
 *        SHA256: 60:C4:DD:AA:F6:C6:BF:74:00:0F:76:A8:8D:4C:71:58:0D:59:64:A1:B8:FB:98:CD:E0:BA:4E:DB:E0:D6:A4:76
 *   ✅ APK generado con Bubblewrap
 *        keystore: ~/android.keystore  alias: android
 *        APK:    ~/app-release-signed.apk
 *        Bundle: ~/app-release-bundle.aab  ← este va a Play Store
 *   ✅ Logo VoraRep real en Header, LandingScreen y LoginScreen
 *      (reemplazó emoji 🚚 hardcodeado)
 *   ✅ Botón + en ClientesScreen visible sobre el TabBar (z-60, bottom-[88px])
 *   ✅ Email real del usuario en PerfilScreen (store.userEmail)
 *
 * ══════════════════════════════════════════════════════════════════
 * PENDIENTE — LO QUE FALTA PARA PUBLICAR EN PLAY STORE
 * ══════════════════════════════════════════════════════════════════
 *
 * 1. SCREENSHOTS para Play Store
 *    - Sacar capturas reales de la app con clientes cargados
 *    - Mínimo 2, máximo 8, portrait 9:16 (recomendado 1080×1920px)
 *    - Guardar como public/screenshot-1.png y public/screenshot-2.png
 *    - Son las imágenes que ven los usuarios en Play Store antes de instalar
 *
 * 2. SUBIR A GOOGLE PLAY CONSOLE
 *    - URL: https://play.google.com/console
 *    - Cuenta de developer: $25 pago único (si no la tenés, crearla primero)
 *    - Crear nueva app → tipo: Aplicación → gratis
 *    - Subir: ~/app-release-bundle.aab
 *    - Completar listing:
 *        Título: "VoraRep – Gestión de entregas"
 *        Descripción corta (80 chars max)
 *        Descripción larga
 *        Categoría: Productividad / Negocios
 *        Privacy Policy URL: https://app.vora-system.com/privacy.html
 *        Screenshots (mínimo 2)
 *        Feature graphic: 1024×500px (banner de la app en Play Store)
 *        Content rating: completar el cuestionario (responder todo No)
 *
 * 3. LIGHTHOUSE AUDIT (opcional pero recomendado)
 *    - Correr: npx lighthouse https://app.vora-system.com --view
 *    - Score PWA debe ser alto para que Google valide bien la TWA
 *
 * 4. DOMINIO PROPIO (futuro)
 *    - Cuando tengas dominio (ej: vorarep.com o vora-system.com/rep):
 *      a. Cambiar en twa-manifest.json: applicationId y host
 *      b. Regenerar APK con bubblewrap build
 *      c. Actualizar public/.well-known/assetlinks.json con nuevo package_name
 *      d. Actualizar vite.config.js manifest start_url y scope
 *      e. Nuevo SHA256 si cambió el keystore (mismo keystore = mismo SHA256)
 *
 * ══════════════════════════════════════════════════════════════════
 * iOS / App Store (después de validar en Android)
 * ══════════════════════════════════════════════════════════════════
 *   - Requiere Capacitor: npm install @capacitor/core @capacitor/ios
 *   - npx cap add ios → genera proyecto Xcode
 *   - Apple Developer Program: $99/año
 *   - Privacy Nutrition Labels: declarar location, email, usage data
 *   - Mínimo iOS: 16.0 (para Web Push support en PWA)
 * ══════════════════════════════════════════════════════════════════
 *
 * NOTAS TÉCNICAS PARA PRÓXIMA SESIÓN
 * ────────────────────────────────────
 * - URL producción: https://app.vora-system.com (Vercel, repo: frankodlv77/vorarep)
 * - Stack: React 18 + Vite 6, Zustand v5, Supabase, Tailwind, PWA (vite-plugin-pwa)
 * - SW: workbox generateSW, cacheId vorarep-v3, skipWaiting + clientsClaim
 * - Íconos: public/icon-vorarep-{192,512,maskable}.png
 * - Para futuro re-build APK: cd ~ && npx @bubblewrap/cli build (pide password del keystore)
 */

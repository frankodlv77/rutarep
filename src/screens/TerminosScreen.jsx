export default function TerminosScreen({ onBack }) {
  return (
    <div className="h-screen bg-[#0b1320] flex flex-col">
      {/* Header */}
      <div className="bg-[#131e2e] border-b border-white/7 px-5 py-4 flex items-center gap-3 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="text-[#6b85a0] hover:text-amber-400 transition-colors text-[22px] leading-none">←</button>
        )}
        <h1 className="font-heading font-extrabold text-[16px] text-[#f0f4f8]">Términos y Condiciones</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 text-[13px] text-[#a0b4c8] leading-relaxed">

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">¿Qué es RutaRep?</h2>
          <p>RutaRep es una aplicación web diseñada para repartidores y distribuidoras independientes. Permite organizar rutas de reparto, registrar entregas y cobros, gestionar clientes y consultar historial de actividad. Está pensada para uso individual: cada cuenta accede únicamente a sus propios datos.</p>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Datos que recolectamos</h2>
          <ul className="space-y-1 list-disc list-inside">
            <li><span className="text-[#f0f4f8] font-medium">Cuenta:</span> dirección de correo electrónico y contraseña (encriptada).</li>
            <li><span className="text-[#f0f4f8] font-medium">Negocio:</span> nombre de tu empresa o negocio (opcional).</li>
            <li><span className="text-[#f0f4f8] font-medium">Clientes:</span> nombre, dirección, teléfono, notas y código de cada cliente que vos registrás.</li>
            <li><span className="text-[#f0f4f8] font-medium">Ubicación GPS:</span> usada únicamente para ordenar tu ruta por cercanía. No se almacena de forma permanente.</li>
            <li><span className="text-[#f0f4f8] font-medium">Fotos de comprobantes:</span> imágenes que cargás voluntariamente al registrar entregas.</li>
            <li><span className="text-[#f0f4f8] font-medium">Historial:</span> registro de entregas, montos cobrados y comisiones calculadas.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Cómo usamos esos datos</h2>
          <p>Los datos se utilizan exclusivamente para el funcionamiento de la aplicación. No vendemos, cedemos ni compartimos tu información con terceros. No utilizamos tus datos con fines publicitarios ni de análisis externos.</p>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Almacenamiento y seguridad</h2>
          <p>Todos los datos se almacenan en servidores seguros provistos por Supabase (infraestructura AWS). La comunicación entre la app y los servidores se realiza mediante HTTPS con cifrado TLS. El acceso a los datos está protegido por Row Level Security: ningún usuario puede ver los datos de otro.</p>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Tus derechos y eliminación de datos</h2>
          <p>Podés eliminar tu cuenta y todos tus datos en cualquier momento desde la pantalla de <span className="text-amber-400">Perfil → Eliminar mi cuenta</span>. Esta acción es irreversible e incluye clientes, rutas, historial, sesiones y archivos de comprobantes.</p>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Soporte</h2>
          <p>Para consultas, reclamos o solicitudes de información escribinos a: <span className="text-amber-400">soporte@vora-system.com</span></p>
        </section>

        <section>
          <h2 className="font-heading font-bold text-[14px] text-[#f0f4f8] mb-2">Ley aplicable</h2>
          <p>Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia será resuelta ante los tribunales ordinarios competentes de la Ciudad de Mendoza, Argentina.</p>
        </section>

        <p className="text-[11px] text-[#4a6080] pt-2">Última actualización: junio 2026.</p>

        <div className="h-8" />
      </div>
    </div>
  )
}

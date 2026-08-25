export default function LandingScreen({ onLogin }) {
  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center px-5">
      <div className="flex items-center gap-3 mb-6">
        <img
          src="/icon-vorarep-192.png?v=2"
          alt="VoraRep"
          className="w-[48px] h-[48px] rounded-[14px] flex-shrink-0"
          style={{ objectFit: 'cover' }}
        />
        <h1 className="font-heading text-[28px] font-extrabold text-textc">VoraRep</h1>
      </div>
      <p className="text-[13px] text-muted mb-8 text-center max-w-[280px]">
        Acceso por invitación únicamente
      </p>
      <button
        onClick={onLogin}
        className="btn-shimmer w-full max-w-[300px] font-heading font-bold text-[15px] py-[14px] rounded-xl"
      >
        Ingresar
      </button>
    </div>
  )
}

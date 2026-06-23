import useStore from '../../store/useStore'

export default function Toast() {
  const toast = useStore(s => s.toast)

  return (
    <div className={`
      fixed bottom-7 left-1/2 -translate-x-1/2 z-[999]
      bg-[#1f3050] border border-white/10 text-[#f0f4f8]
      px-5 py-[10px] rounded-full text-xs font-medium whitespace-nowrap
      pointer-events-none transition-all duration-200
      ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
    `}>
      {toast?.msg}
    </div>
  )
}

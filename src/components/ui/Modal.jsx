import useStore from '../../store/useStore'

export default function Modal({ id, children, className = '' }) {
  const modal       = useStore(s => s.modal)
  const closeModal  = useStore(s => s.closeModal)
  const isOpen      = modal?.type === id

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[200] flex items-end backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) closeModal() }}
    >
      <div className={`bg-surface rounded-[22px_22px_0_0] border-t border-[var(--c-border)] w-full max-h-[92vh] overflow-y-auto animate-slideUp ${className}`}>
        <div className="w-9 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-5" />
        {children}
      </div>
    </div>
  )
}

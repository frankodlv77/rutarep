import { useState } from 'react'
import Modal from '../components/ui/Modal'
import useStore from '../store/useStore'

export default function ConfirmModal() {
  const modal      = useStore(s => s.modal)
  const closeModal = useStore(s => s.closeModal)
  const [typed, setTyped] = useState('')

  const { title, msg, onConfirm, confirmText } = modal?.data || {}

  const canConfirm = !confirmText || typed === confirmText

  function handleConfirm() {
    if (!canConfirm) return
    closeModal()
    setTyped('')
    onConfirm?.()
  }

  function handleClose() {
    closeModal()
    setTyped('')
  }

  return (
    <Modal id="confirm" onClose={handleClose}>
      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-textc mb-2">{title || '¿Estás seguro?'}</h2>
        {msg && <p className="text-[13px] text-muted mb-4 leading-relaxed">{msg}</p>}

        {confirmText && (
          <div className="mb-4">
            <p className="text-[12px] text-muted mb-2">
              Escribí <span className="font-bold text-red-400 font-mono">{confirmText}</span> para confirmar:
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
              className="w-full bg-bg border border-red-500/40 rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-red-500 placeholder:text-muted2 font-mono transition-colors"
            />
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full bg-danger text-white font-heading font-bold text-[13px] py-[13px] rounded-xl active:scale-[.97] transition-transform disabled:opacity-30"
        >Confirmar</button>
        <div className="h-2" />
        <button
          onClick={handleClose}
          className="w-full bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[13px] py-[13px] rounded-xl"
        >Cancelar</button>
      </div>
    </Modal>
  )
}

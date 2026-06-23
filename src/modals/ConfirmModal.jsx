import Modal from '../components/ui/Modal'
import useStore from '../store/useStore'

export default function ConfirmModal() {
  const modal      = useStore(s => s.modal)
  const closeModal = useStore(s => s.closeModal)

  const { title, msg, onConfirm } = modal?.data || {}

  return (
    <Modal id="confirm">
      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-[#f0f4f8] mb-2">{title || '¿Estás segura?'}</h2>
        {msg && <p className="text-[13px] text-[#6b85a0] mb-5 leading-relaxed">{msg}</p>}
        <button
          onClick={() => { closeModal(); onConfirm?.() }}
          className="w-full bg-danger text-white font-heading font-bold text-[13px] py-[13px] rounded-xl active:scale-[.97] transition-transform"
        >Confirmar</button>
        <div className="h-2" />
        <button
          onClick={closeModal}
          className="w-full bg-[#1a2840] border border-white/7 text-[#f0f4f8] font-heading font-bold text-[13px] py-[13px] rounded-xl"
        >Cancelar</button>
      </div>
    </Modal>
  )
}

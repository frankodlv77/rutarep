import { useState, useEffect, useRef } from 'react'
import Modal from '../components/ui/Modal'
import Field, { Input, Textarea } from '../components/ui/Field'
import useStore from '../store/useStore'

const METODOS = [
  { id: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { id: 'tarjeta',       label: 'Tarjeta',       icon: '💳' },
  { id: 'efectivo',      label: 'Efectivo',      icon: '💵' },
  { id: 'otro',          label: 'Otro',          icon: '❓' },
]

const TIPOS = [
  { id: 'entregado',  label: 'Entregado',    icon: '✅', active: 'border-emerald-400 bg-emerald-400/10 text-[#f0f4f8]' },
  { id: 'devolucion', label: 'Devolución',   icon: '🔄', active: 'border-blue-400 bg-blue-400/10 text-[#f0f4f8]' },
  { id: 'parcial',    label: 'Pago parcial', icon: '💸', active: 'border-amber-400 bg-amber-400/10 text-[#f0f4f8]' },
  { id: 'cancelado',  label: 'Cancelado',    icon: '❌', active: 'border-red-400 bg-red-400/10 text-[#f0f4f8]' },
]

const MOTIVOS_CANCEL = [
  'No tenía dinero',
  'Canceló el pedido',
  'No estaba en casa',
  'Rechazó la mercadería',
  'Otro',
]

const emptyForm = {
  tipo: 'entregado',
  metodo_pago: 'efectivo',
  notas_pago: '',
  monto: '',
  monto_original: '',
  monto_devolucion: '',
  monto_total: '',
  monto_pagado: '',
  motivo_cancelacion: 'No tenía dinero',
  obs: '',
  cobro_deuda: false,
}

function fmtMoney(n) {
  if (!n) return '$0'
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function EntregaModal() {
  const modal                   = useStore(s => s.modal)
  const closeModal              = useStore(s => s.closeModal)
  const confirmarEntrega        = useStore(s => s.confirmarEntrega)
  const editarEntregaHistorial  = useStore(s => s.editarEntregaHistorial)
  const uploadFoto              = useStore(s => s.uploadFoto)
  const showToast               = useStore(s => s.showToast)

  const [form, setForm]       = useState(emptyForm)
  const [fotos, setFotos]     = useState([])
  const [uploading, setUploading] = useState(false)
  const [deudaStep, setDeudaStep] = useState(false)
  const fileRef    = useRef()
  const galleryRef = useRef()

  const isOpen    = modal?.type === 'entrega'
  const clienteId = modal?.data?.clienteId
  const nombre    = modal?.data?.clienteNombre || ''
  const dir       = modal?.data?.clienteDir    || ''
  const deuda     = modal?.data?.clienteDeuda  || 0
  const editData   = modal?.data?.editData      || null
  const historialId  = modal?.data?.historialId  ?? null
  const entregaIdx   = modal?.data?.entregaIdx   ?? null
  const isEditing  = !!editData

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setForm({
          tipo:               editData.tipo               || 'entregado',
          metodo_pago:        editData.metodo_pago        || 'efectivo',
          notas_pago:         editData.notas_pago         || '',
          monto:              editData.monto != null      ? String(editData.monto) : '',
          monto_original:     editData.monto_original     ? String(editData.monto_original) : '',
          monto_devolucion:   editData.monto_devolucion   ? String(editData.monto_devolucion) : '',
          monto_total:        editData.monto_total        ? String(editData.monto_total) : '',
          monto_pagado:       editData.monto_pagado       ? String(editData.monto_pagado) : '',
          motivo_cancelacion: editData.motivo_cancelacion || 'No tenía dinero',
          obs:                editData.obs                || '',
          cobro_deuda:        false,
        })
      } else {
        setForm(emptyForm)
      }
      if (editData?.foto_urls?.length) {
        setFotos(editData.foto_urls.map(url => ({ file: null, preview: url })))
      } else if (editData?.foto_url) {
        setFotos([{ file: null, preview: editData.foto_url }])
      } else {
        setFotos([])
      }
      const clienteDeuda = modal?.data?.clienteDeuda || 0
      if (!editData && clienteDeuda > 0) {
        setDeudaStep(true)
        navigator.vibrate?.([300, 150, 300])
      } else {
        setDeudaStep(false)
      }
    }
  }, [isOpen])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotos(prev => [...prev, { file, preview: URL.createObjectURL(file) }])
    fileRef.current.value = ''
  }

  const removeFoto = (idx) => {
    setFotos(prev => {
      const f = prev[idx]
      if (f.file) URL.revokeObjectURL(f.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // Computed values
  const montoNeto = form.tipo === 'devolucion'
    ? Math.max(0, (+form.monto_original || 0) - (+form.monto_devolucion || 0))
    : null

  const deudaNueva = form.tipo === 'parcial'
    ? Math.max(0, (+form.monto_total || 0) - (+form.monto_pagado || 0))
    : null

  const needsPayment = form.tipo !== 'cancelado'

  const confirmar = async () => {
    // Validaciones por tipo
    if (form.tipo === 'entregado') {
      if (!form.monto || isNaN(+form.monto) || +form.monto < 0) {
        showToast('⚠️ Ingresá el monto cobrado'); return
      }
    }
    if (form.tipo === 'devolucion') {
      if (!form.monto_original || +form.monto_original <= 0) {
        showToast('⚠️ Ingresá el monto original'); return
      }
      if (!form.monto_devolucion || isNaN(+form.monto_devolucion) || +form.monto_devolucion < 0) {
        showToast('⚠️ Ingresá el monto devuelto'); return
      }
      if (+form.monto_devolucion >= +form.monto_original) {
        showToast('⚠️ La devolución no puede ser mayor al monto original'); return
      }
    }
    if (form.tipo === 'parcial') {
      if (!form.monto_total || +form.monto_total <= 0) {
        showToast('⚠️ Ingresá el monto total a cobrar'); return
      }
      if (!form.monto_pagado || isNaN(+form.monto_pagado) || +form.monto_pagado < 0) {
        showToast('⚠️ Ingresá cuánto pagó ahora'); return
      }
      if (+form.monto_pagado >= +form.monto_total) {
        showToast('⚠️ Si pagó todo, usá "Entregado" en su lugar'); return
      }
    }

    setUploading(true)
    const uploadedUrls = await Promise.all(
      fotos.map(f => f.file ? uploadFoto(f.file, clienteId) : Promise.resolve(f.preview))
    )
    const foto_urls = uploadedUrls.filter(Boolean)
    const foto_url  = foto_urls[0] || null

    let payload = { tipo: form.tipo, obs: form.obs.trim(), foto_url, foto_urls,
                    ...(isEditing && { hora: editData.hora, isEdit: true }) }

    if (form.tipo === 'entregado') {
      payload = { ...payload, metodo_pago: form.metodo_pago, notas_pago: form.notas_pago.trim(),
                  monto: +form.monto, cobro_deuda: form.cobro_deuda }
    } else if (form.tipo === 'devolucion') {
      payload = { ...payload, metodo_pago: form.metodo_pago, notas_pago: form.notas_pago.trim(),
                  monto: montoNeto, monto_original: +form.monto_original,
                  monto_devolucion: +form.monto_devolucion, cobro_deuda: form.cobro_deuda }
    } else if (form.tipo === 'parcial') {
      payload = { ...payload, metodo_pago: form.metodo_pago, notas_pago: form.notas_pago.trim(),
                  monto: +form.monto_pagado, monto_total: +form.monto_total,
                  monto_pagado: +form.monto_pagado, deuda_generada: deudaNueva }
    } else if (form.tipo === 'cancelado') {
      payload = { ...payload, monto: 0, motivo_cancelacion: form.motivo_cancelacion }
    }

    if (historialId !== null) {
      await editarEntregaHistorial(historialId, entregaIdx, { ...payload, hora: editData?.hora })
    } else {
      await confirmarEntrega(clienteId, payload)
    }
    setUploading(false)
    closeModal()
  }

  return (
    <Modal id="entrega">
      {/* ── PANTALLA DE DEUDA ── */}
      {deudaStep ? (
        <div className="px-[18px] pb-10 flex flex-col items-center text-center">
          <div className="w-full rounded-2xl pt-8 pb-6 px-4 mb-6 border border-red-500/40"
               style={{ background: 'linear-gradient(160deg, rgba(239,68,68,0.18) 0%, rgba(11,19,32,0) 70%)' }}>
            <div className="text-[60px] mb-2" style={{ animation: 'bounce 1s infinite' }}>🚨</div>
            <p className="text-[11px] font-bold text-red-400 uppercase tracking-[2px] mb-2">Deuda pendiente</p>
            <p className="text-[20px] font-extrabold text-[#f0f4f8] font-heading leading-tight mb-1">{nombre}</p>
            {dir ? <p className="text-[12px] text-[#6b85a0] mb-3">{dir}</p> : <div className="mb-3" />}
            <p className="text-[13px] text-[#6b85a0] mb-1">debe cobrarle</p>
            <p className="text-[52px] font-extrabold text-red-400 font-heading leading-none"
               style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>{fmtMoney(deuda)}</p>
            <p className="text-[11px] text-red-400/50 mt-2">de visita anterior</p>
          </div>

          <p className="text-[13px] text-[#6b85a0] mb-5">¿Cobró la deuda en esta visita?</p>

          <button
            onClick={() => { set('cobro_deuda', true); setDeudaStep(false) }}
            className="w-full bg-emerald-500 text-white font-heading font-bold text-[15px] py-4 rounded-xl mb-3 active:scale-[.97] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            ✅ Sí, cobré la deuda
          </button>
          <button
            onClick={() => setDeudaStep(false)}
            className="w-full bg-[#1a2840] border border-white/10 text-[#6b85a0] font-heading font-bold text-[13px] py-[13px] rounded-xl active:scale-[.97] transition-transform"
          >
            Continuar sin cobrar →
          </button>
          <button onClick={closeModal} className="mt-4 text-[11px] text-[#6b85a0] underline">Cancelar</button>
        </div>
      ) : (

      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-[#f0f4f8] mb-1">{isEditing ? '✏️ Editar entrega' : 'Registrar visita'}</h2>
        <p className="text-[13px] text-[#6b85a0] mb-4">{nombre}{dir ? ` · ${dir}` : ''}</p>

        {/* Banner de deuda (compacto, solo recordatorio si ya eligió cobrar) */}
        {deuda > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-[10px] mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold text-red-400">Deuda pendiente: {fmtMoney(deuda)}</p>
              <p className="text-[10px] text-[#6b85a0] mt-[2px]">Saldo de visita anterior</p>
            </div>
            {form.tipo !== 'cancelado' && form.tipo !== 'parcial' && (
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={form.cobro_deuda}
                  onChange={e => set('cobro_deuda', e.target.checked)}
                  className="w-4 h-4 accent-emerald-400"
                />
                <span className="text-[11px] text-[#f0f4f8] font-medium">¿Cobró?</span>
              </label>
            )}
          </div>
        )}

        {/* Selector de tipo */}
        <Field label="¿Qué pasó?">
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.id}
                onClick={() => set('tipo', t.id)}
                className={`flex items-center gap-2 px-3 py-[10px] rounded-xl border text-[13px] font-medium transition-all ${
                  form.tipo === t.id ? t.active : 'border-white/7 bg-[#1a2840] text-[#6b85a0]'
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* ── ENTREGADO ── */}
        {form.tipo === 'entregado' && (
          <>
            <Field label="¿Cómo pagó?">
              <div className="grid grid-cols-2 gap-2">
                {METODOS.map(m => (
                  <button key={m.id} onClick={() => set('metodo_pago', m.id)}
                    className={`flex items-center gap-2 px-3 py-[10px] rounded-xl border text-[13px] font-medium transition-all ${
                      form.metodo_pago === m.id
                        ? 'border-amber-400 bg-amber-400/10 text-[#f0f4f8]'
                        : 'border-white/7 bg-[#1a2840] text-[#6b85a0]'
                    }`}><span>{m.icon}</span> {m.label}</button>
                ))}
              </div>
            </Field>
            {form.metodo_pago === 'otro' && (
              <Field label="¿Cómo fue? (aclarar)">
                <Input placeholder="Ej: Cheque, bono, canje..." value={form.notas_pago} onChange={e => set('notas_pago', e.target.value)} />
              </Field>
            )}
            <Field label="Monto cobrado *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b85a0] text-[14px] font-bold pointer-events-none">$</span>
                <Input type="number" placeholder="0" className="pl-7" value={form.monto}
                  onChange={e => set('monto', e.target.value)} inputMode="decimal" />
              </div>
            </Field>
          </>
        )}

        {/* ── DEVOLUCIÓN ── */}
        {form.tipo === 'devolucion' && (
          <>
            <Field label="Monto original a cobrar *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b85a0] text-[14px] font-bold pointer-events-none">$</span>
                <Input type="number" placeholder="0" className="pl-7" value={form.monto_original}
                  onChange={e => set('monto_original', e.target.value)} inputMode="decimal" />
              </div>
            </Field>
            <Field label="Valor del producto devuelto *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b85a0] text-[14px] font-bold pointer-events-none">$</span>
                <Input type="number" placeholder="0" className="pl-7" value={form.monto_devolucion}
                  onChange={e => set('monto_devolucion', e.target.value)} inputMode="decimal" />
              </div>
            </Field>
            {form.monto_original && form.monto_devolucion && (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl px-3 py-[10px] mb-3 flex items-center justify-between">
                <span className="text-[12px] text-[#6b85a0]">Cobrar neto</span>
                <span className="font-heading font-extrabold text-[16px] text-blue-300">{fmtMoney(montoNeto)}</span>
              </div>
            )}
            <Field label="¿Cómo pagó?">
              <div className="grid grid-cols-2 gap-2">
                {METODOS.map(m => (
                  <button key={m.id} onClick={() => set('metodo_pago', m.id)}
                    className={`flex items-center gap-2 px-3 py-[10px] rounded-xl border text-[13px] font-medium transition-all ${
                      form.metodo_pago === m.id
                        ? 'border-amber-400 bg-amber-400/10 text-[#f0f4f8]'
                        : 'border-white/7 bg-[#1a2840] text-[#6b85a0]'
                    }`}><span>{m.icon}</span> {m.label}</button>
                ))}
              </div>
            </Field>
            {form.metodo_pago === 'otro' && (
              <Field label="¿Cómo fue? (aclarar)">
                <Input placeholder="Ej: Cheque, bono, canje..." value={form.notas_pago} onChange={e => set('notas_pago', e.target.value)} />
              </Field>
            )}
          </>
        )}

        {/* ── PAGO PARCIAL ── */}
        {form.tipo === 'parcial' && (
          <>
            <Field label="Monto total que debía pagar *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b85a0] text-[14px] font-bold pointer-events-none">$</span>
                <Input type="number" placeholder="0" className="pl-7" value={form.monto_total}
                  onChange={e => set('monto_total', e.target.value)} inputMode="decimal" />
              </div>
            </Field>
            <Field label="Monto que pagó ahora *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b85a0] text-[14px] font-bold pointer-events-none">$</span>
                <Input type="number" placeholder="0" className="pl-7" value={form.monto_pagado}
                  onChange={e => set('monto_pagado', e.target.value)} inputMode="decimal" />
              </div>
            </Field>
            {form.monto_total && form.monto_pagado && deudaNueva > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-[10px] mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#6b85a0]">Queda pendiente (deuda)</p>
                  <p className="text-[10px] text-amber-400/70 mt-[1px]">Se suma a su saldo deudor</p>
                </div>
                <span className="font-heading font-extrabold text-[16px] text-amber-400">{fmtMoney(deudaNueva)}</span>
              </div>
            )}
            <Field label="¿Cómo pagó la parte?">
              <div className="grid grid-cols-2 gap-2">
                {METODOS.map(m => (
                  <button key={m.id} onClick={() => set('metodo_pago', m.id)}
                    className={`flex items-center gap-2 px-3 py-[10px] rounded-xl border text-[13px] font-medium transition-all ${
                      form.metodo_pago === m.id
                        ? 'border-amber-400 bg-amber-400/10 text-[#f0f4f8]'
                        : 'border-white/7 bg-[#1a2840] text-[#6b85a0]'
                    }`}><span>{m.icon}</span> {m.label}</button>
                ))}
              </div>
            </Field>
            {form.metodo_pago === 'otro' && (
              <Field label="¿Cómo fue? (aclarar)">
                <Input placeholder="Ej: Cheque, bono, canje..." value={form.notas_pago} onChange={e => set('notas_pago', e.target.value)} />
              </Field>
            )}
          </>
        )}

        {/* ── CANCELADO ── */}
        {form.tipo === 'cancelado' && (
          <Field label="Motivo">
            <div className="flex flex-col gap-2">
              {MOTIVOS_CANCEL.map(m => (
                <button key={m} onClick={() => set('motivo_cancelacion', m)}
                  className={`text-left px-3 py-[10px] rounded-xl border text-[13px] font-medium transition-all ${
                    form.motivo_cancelacion === m
                      ? 'border-red-400 bg-red-400/10 text-[#f0f4f8]'
                      : 'border-white/7 bg-[#1a2840] text-[#6b85a0]'
                  }`}>{m}</button>
              ))}
            </div>
          </Field>
        )}

        {/* Fotos — solo si no cancelado */}
        {form.tipo !== 'cancelado' && (
          <Field label={`Fotos del comprobante${fotos.length > 0 ? ` (${fotos.length})` : ' (opcional)'}`}>
            {/* Cámara */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} className="hidden" />
            {/* Galería */}
            <input ref={galleryRef} type="file" accept="image/*"
              onChange={handlePhoto} className="hidden" />
            {fotos.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.preview} alt="Comprobante" className="w-20 h-20 object-cover rounded-xl border border-white/10" />
                    <button onClick={() => removeFoto(i)}
                      className="absolute -top-1 -right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => fileRef.current.click()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1a2840] border border-dashed border-white/15 rounded-xl py-4 text-[#6b85a0] text-[13px] transition-colors active:bg-[#1f3050]">
                📷 Cámara
              </button>
              <button onClick={() => galleryRef.current.click()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1a2840] border border-dashed border-white/15 rounded-xl py-4 text-[#6b85a0] text-[13px] transition-colors active:bg-[#1f3050]">
                🖼️ Galería
              </button>
            </div>
          </Field>
        )}

        {/* Observación */}
        <Field label="Observación (opcional)">
          <Input
            placeholder={form.tipo === 'cancelado' ? 'Aclaración adicional...' : 'Firmó remito, entregó a empleado...'}
            value={form.obs}
            onChange={e => set('obs', e.target.value)}
          />
        </Field>

        <button
          onClick={confirmar}
          disabled={uploading}
          className={`w-full text-white font-heading font-bold text-[13px] py-[13px] rounded-xl active:scale-[.97] transition-transform disabled:opacity-60 ${
            form.tipo === 'cancelado' ? 'bg-red-500' :
            form.tipo === 'parcial'   ? 'bg-amber-500' :
            form.tipo === 'devolucion'? 'bg-blue-500' :
                                        'bg-emerald-500'
          }`}
        >
          {uploading ? 'Guardando...' :
           form.tipo === 'cancelado'  ? '❌ Registrar cancelación' :
           form.tipo === 'parcial'    ? '💸 Registrar pago parcial' :
           form.tipo === 'devolucion' ? '🔄 Registrar devolución' :
                                        '✅ Marcar como entregado'}
        </button>
        <div className="h-2" />
        <button onClick={closeModal}
          className="w-full bg-[#1a2840] border border-white/7 text-[#f0f4f8] font-heading font-bold text-[13px] py-[13px] rounded-xl">
          Cancelar
        </button>
      </div>

      )} {/* fin else deudaStep */}
    </Modal>
  )
}

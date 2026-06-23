export default function Field({ label, children, className = '' }) {
  return (
    <div className={`mb-3 ${className}`}>
      {label && <label className="block text-[10px] font-semibold text-[#6b85a0] uppercase tracking-[.5px] mb-[5px]">{label}</label>}
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-[#1a2840] border border-white/7 rounded-[10px] px-3 py-[11px] text-[#f0f4f8] text-sm outline-none transition-colors focus:border-amber-400 placeholder:text-[#6b85a0]'

export function Input({ className = '', ...props }) {
  return <input className={`${inputCls} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${inputCls} resize-none ${className}`} rows={3} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${inputCls} ${className}`} {...props}>
      {children}
    </select>
  )
}

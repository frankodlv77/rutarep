export default function Field({ label, children, className = '' }) {
  return (
    <div className={`mb-3 ${className}`}>
      {label && <label className="block text-[10px] font-semibold text-muted uppercase tracking-[.5px] mb-[5px]">{label}</label>}
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-surface2 border border-[var(--c-border)] rounded-[10px] px-3 py-[11px] text-textc text-sm outline-none transition-colors focus:border-amber-400 placeholder:text-muted'

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

const ZONE_COLORS = {
  'Centro':     'bg-amber-500/15 text-amber-300',
  'Godoy Cruz': 'bg-blue-500/15 text-blue-400',
  'Maipú':      'bg-emerald-500/15 text-emerald-400',
  'Guaymallén': 'bg-teal-500/15 text-teal-400',
  'Las Heras':  'bg-red-500/15 text-red-400',
  'Luján':      'bg-purple-500/15 text-purple-400',
  'Otro':       'bg-white/7 text-muted',
}

export default function ZoneBadge({ zona }) {
  const cls = ZONE_COLORS[zona] || ZONE_COLORS['Otro']
  return (
    <span className={`inline-block px-2 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {zona || 'Sin zona'}
    </span>
  )
}

export { ZONE_COLORS }

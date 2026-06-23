export default function Spinner({ size = 20 }) {
  return (
    <div
      className="border-2 border-white/20 border-t-amber-400 rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  )
}

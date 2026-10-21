export function EffectsLayer() {
  return (
    <div aria-hidden="true" className="effects-layer">
      <span className="scan-beam" />
      <span className="noise-field" />
      {Array.from({ length: 8 }, (_, index) => (
        <span className={`particle particle--${index + 1}`} key={index} />
      ))}
    </div>
  )
}

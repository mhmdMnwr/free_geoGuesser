export function Podium({ players }: { players: any[] }) {
  const p1 = players?.[0]
  const p2 = players?.[1]
  const p3 = players?.[2]

  return (
    <div className="podium">
      {p2 && (
        <div className="podium-player podium-player--second">
          <span className="avatar avatar--lime">{String(p2.username || "P2").slice(0, 2).toUpperCase()}</span>
          <strong>{p2.username}</strong>
          <small>{(p2.totalScore || 0).toLocaleString()}</small>
          <i>2</i>
        </div>
      )}
      {p1 && (
        <div className="podium-player podium-player--first">
          <span className="avatar avatar--cyan">{String(p1.username || "P1").slice(0, 2).toUpperCase()}</span>
          <strong>{p1.username}</strong>
          <small>{(p1.totalScore || 0).toLocaleString()}</small>
          <i>1</i>
        </div>
      )}
      {p3 && (
        <div className="podium-player podium-player--third">
          <span className="avatar avatar--orange">{String(p3.username || "P3").slice(0, 2).toUpperCase()}</span>
          <strong>{p3.username}</strong>
          <small>{(p3.totalScore || 0).toLocaleString()}</small>
          <i>3</i>
        </div>
      )}
    </div>
  )
}

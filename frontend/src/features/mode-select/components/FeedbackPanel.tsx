import { useState } from "react"
import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"

interface FeedbackPanelProps {
  username: string
  onBackToPlay: () => void
}

const CATEGORIES = ["Gameplay Idea", "Bug Report", "Map & Locations", "UI / Experience"]

export function FeedbackPanel({ username, onBackToPlay }: FeedbackPanelProps) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submitFeedback = async () => {
    if (!message.trim() || isSubmitting) return
    setIsSubmitting(true)

    const payload = {
      username: username || "Operative",
      category,
      rating,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    }

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.warn("Feedback network dispatch error, using local fallback:", err)
    }

    try {
      const existing = JSON.parse(localStorage.getItem("guessiha_feedback") || "[]")
      existing.push(payload)
      localStorage.setItem("guessiha_feedback", JSON.stringify(existing))
    } catch {}

    setIsSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="menu-stage-panel panel">
        <div className="py-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
            <Icon name="check" size={28} />
          </div>
          <h2 className="menu-stage-title">FEEDBACK TRANSMITTED</h2>
          <p className="text-slate-300 text-sm max-w-md">
            Thank you, <strong className="text-sky-400">{username || "Operative"}</strong>. Your report has been dispatched directly to the guessiha development team.
          </p>
          <div className="flex gap-3 mt-3">
            <GameButton onClick={() => { setMessage(""); setSubmitted(false) }} variant="outline">
              SEND ANOTHER
            </GameButton>
            <GameButton icon="play" onClick={onBackToPlay} variant="primary">
              BACK TO PLAY
            </GameButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form className="menu-stage-panel panel" onSubmit={(e) => { e.preventDefault(); submitFeedback() }}>
      <div className="menu-stage-header">
        <span className="section-index">/ DIRECT CHANNEL</span>
        <h2 className="menu-stage-title">SEND FEEDBACK</h2>
        <p className="menu-stage-sub">
          Spot a broken road view, want a new map region, or have an idea for guessiha? Tell us below.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase text-sky-400 mb-2 tracking-widest">CATEGORY</label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              className={`px-3 py-2 text-xs font-mono uppercase rounded border text-left transition cursor-pointer ${
                category === cat
                  ? "bg-sky-500/20 border-sky-400 text-white font-bold"
                  : "bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
              key={cat}
              onClick={() => setCategory(cat)}
              type="button"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase text-sky-400 mb-2 tracking-widest">MATCH EXPERIENCE RATING</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              className={`flex-1 py-2 rounded border font-mono text-sm font-bold transition cursor-pointer ${
                rating >= star ? "bg-lime-400/20 border-lime-400 text-lime-300" : "bg-slate-900/80 border-slate-800 text-slate-500"
              }`}
              key={star}
              onClick={() => setRating(star)}
              type="button"
            >
              ★ {star}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase text-sky-400 mb-2 tracking-widest">YOUR MESSAGE</label>
        <textarea
          className="w-full bg-slate-900/90 border border-slate-700 focus:border-sky-400 rounded-lg p-3 text-slate-100 text-sm outline-none transition resize-none"
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your feedback, bug report, or feature request..."
          rows={3}
          value={message}
        />
      </div>

      <div className="flex justify-end gap-3">
        <GameButton onClick={onBackToPlay} variant="ghost">BACK</GameButton>
        <GameButton disabled={!message.trim() || isSubmitting} icon="check" onClick={submitFeedback} variant="primary">
          {isSubmitting ? "TRANSMITTING..." : "SUBMIT FEEDBACK"}
        </GameButton>
      </div>
    </form>
  )
}

export default FeedbackPanel

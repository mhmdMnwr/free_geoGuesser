import type { LobbySocketContext } from "./useLobbySocketEvents"
import { setStoredActiveRoom } from "../shared/utils/cookies"

export function bindCrownSocketEvents(ctx: LobbySocketContext) {
  const { socket, state } = ctx

  socket.on("crown_demanded", (data: any) => {
    state.setCrownDemandNotice({
      roomId: data.roomId,
      claimantUsername: data.claimantUsername,
      claimantPublicId: data.claimantPublicId,
      timeoutSeconds: data.timeoutSeconds || 4,
    })
    ctx.addToast(`⚠️ Operative "${data.claimantUsername}" demands the Crown!`, "warning")
  })

  socket.on("crown_demand_sent", (data: any) => {
    state.setCrownClaimPending(true)
    ctx.addToast(data.message || "Crown challenge issued. Waiting for Squad Leader...", "info")
  })

  socket.on("crown_vote_started", (data: any) => {
    state.setCrownDemandNotice(null)
    state.setCrownVoteNotice({
      roomId: data.roomId,
      claimantUsername: data.claimantUsername,
      claimantPublicId: data.claimantPublicId,
      currentHostUsername: data.currentHostUsername,
      timeoutSeconds: data.timeoutSeconds || 8,
      yesCount: data.yesCount || 0,
      noCount: data.noCount || 0,
      totalEligible: data.totalEligible || 0,
    })
    state.setHasVotedCrown(false)
    ctx.addToast(`🗳️ Squad Referendum: Vote on "${data.claimantUsername}"!`, "warning")
  })

  socket.on("crown_vote_update", (data: any) => {
    state.setCrownVoteNotice((prev) =>
      prev ? { ...prev, yesCount: data.yesCount, noCount: data.noCount, totalEligible: data.totalEligible } : null,
    )
  })

  socket.on("crown_election_result", (data: any) => {
    state.setCrownDemandNotice(null)
    state.setCrownVoteNotice(null)
    state.setHasVotedCrown(false)
    state.setCrownClaimPending(false)
    state.setCrownElectionResult(data)
    setTimeout(() => state.setCrownElectionResult(null), 5000)
    ctx.addToast(data.message, data.success ? "success" : "info")
  })

  socket.on("host_transferred", (data: any) => {
    const isMe =
      (data.newHostId && data.newHostId === state.clientId) ||
      (data.newHost && data.newHost.toLowerCase() === state.username.toLowerCase())
    state.setIsHost(isMe)
    setStoredActiveRoom(data.roomId, isMe)
    state.setActiveRoom((prev) => (prev ? { ...prev, hostName: data.newHost } : null))
    state.setCrownDemandNotice(null)
    state.setCrownVoteNotice(null)
    state.setHasVotedCrown(false)
    state.setCrownClaimPending(false)
    if (isMe) {
      ctx.addToast("👑 You are now the Squad Leader!", "success")
    } else {
      ctx.addToast(`👑 Operative "${data.newHost}" is now the Squad Leader.`, "info")
    }
  })
}

export default bindCrownSocketEvents

import type { CrownDemandNotice, CrownVoteNotice, CrownElectionResult } from "../../types/game"
import CrownDemandBanner from "./CrownDemandBanner"
import CrownVoteBanner from "./CrownVoteBanner"
import CrownResultBanner from "./CrownResultBanner"

interface CrownNotificationBannerProps {
  demandNotice: CrownDemandNotice | null
  voteNotice: CrownVoteNotice | null
  electionResult: CrownElectionResult | null
  hasVoted: boolean
  onRespondDemand: (accept: boolean) => void
  onVote: (vote: "yes" | "no") => void
  onDismissResult?: () => void
}

export function CrownNotificationBanner({
  demandNotice,
  voteNotice,
  electionResult,
  hasVoted,
  onRespondDemand,
  onVote,
  onDismissResult,
}: CrownNotificationBannerProps) {
  if (demandNotice) {
    return (
      <CrownDemandBanner
        demandNotice={demandNotice}
        onRespondDemand={onRespondDemand}
      />
    )
  }

  if (voteNotice) {
    return (
      <CrownVoteBanner
        voteNotice={voteNotice}
        hasVoted={hasVoted}
        onVote={onVote}
      />
    )
  }

  if (electionResult) {
    return (
      <CrownResultBanner
        electionResult={electionResult}
        onDismissResult={onDismissResult}
      />
    )
  }

  return null
}

export default CrownNotificationBanner

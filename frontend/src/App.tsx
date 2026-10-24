import { ModeSelect } from "./features/mode-select"
import { RoomBrowser, CreateRoomModal } from "./features/room-browser"
import { Lobby, PendingApprovalScreen } from "./features/lobby"
import { GameScreen } from "./features/game"
import { ToastContainer } from "./shared/components/ToastContainer"
import { CrownNotificationBanner } from "./shared/components/CrownNotificationBanner"
import { useToasts } from "./hooks/useToasts"
import { useAppState } from "./hooks/useAppState"
import { useGameSocket } from "./hooks/useGameSocket"
import { useGameActions } from "./hooks/useGameActions"

export default function App() {
  const state = useAppState()
  const { toasts, addToast, removeToast } = useToasts()
  const refs = useGameSocket(state, addToast)
  const actions = useGameActions({ state, ...refs, addToast })

  return (
    <>
      {state.screen === "select" && (
        <ModeSelect
          isCheckingUsername={state.isCheckingUsername}
          isLaunching={state.isLaunching}
          mode={state.selectedMode}
          onContinue={actions.handleContinueFromModeSelect}
          setMode={state.setSelectedMode}
          setUsername={state.setUsername}
          username={state.username}
          usernameError={state.usernameError}
        />
      )}

      {state.screen === "browser" && (
        <>
          <RoomBrowser
            errorMessage={state.usernameError}
            lobbies={state.lobbies}
            onBack={() => state.updateScreen("select")}
            onCreate={() => {
              state.setCreateRoomError(null)
              state.setShowCreateModal(true)
            }}
            onJoin={actions.handleJoinRoom}
            onJoinByCode={actions.handleJoinByCode}
            onSearchCode={actions.handleSearchRoomByCode}
            onUsernameChange={state.setUsername}
            searchedRoom={state.searchedRoom}
            username={state.username}
          />
          <CreateRoomModal
            defaultName={`${state.username}'S SQUAD`}
            error={state.createRoomError}
            isCreating={state.isCreatingRoom}
            isOpen={state.showCreateModal}
            onClose={() => state.setShowCreateModal(false)}
            onSubmit={actions.handleCreateRoomSubmit}
          />
        </>
      )}

      {state.screen === "lobby" && state.activeRoom && (
        <Lobby
          crownClaimPending={state.crownClaimPending}
          isHost={state.isHost}
          onAdmitPlayer={actions.handleAdmitPlayer}
          onBack={actions.handleLeaveRoom}
          onDemandCrown={actions.handleDemandCrown}
          onKickPlayer={actions.handleKickPlayer}
          onRejectPlayer={actions.handleRejectPlayer}
          onStart={actions.handleStartMatch}
          onUpdateSettings={actions.handleUpdateSettings}
          pendingRequests={state.pendingRequests}
          players={state.roomPlayers}
          room={state.activeRoom}
        />
      )}

      {state.screen === "pending" && (
        <PendingApprovalScreen
          onCancel={actions.handleCancelPending}
          pendingRoomName={state.pendingRoomName}
        />
      )}

      {state.screen === "game" && state.activeRoom && (
        <GameScreen
          clientId={state.clientId}
          countdownSeconds={state.countdownSeconds}
          crownClaimPending={state.crownClaimPending}
          currentRound={state.currentRound}
          gameOver={state.gameOver}
          hasGuessed={state.hasGuessed}
          isHost={state.isHost}
          myPin={state.myPin}
          onAdmitPlayer={actions.handleAdmitPlayer}
          onDemandCrown={actions.handleDemandCrown}
          onExit={actions.handleLeaveRoom}
          onLockGuess={actions.handleLockGuess}
          onNextRound={actions.handleNextRound}
          onRejectPlayer={actions.handleRejectPlayer}
          onReturnToLobby={actions.handleReturnToLobby}
          onSelectCoords={(coords) => state.setMyPin(coords)}
          pendingRequests={state.pendingRequests}
          players={state.roomPlayers}
          room={state.activeRoom}
          roundResults={state.roundResults}
          totalRounds={state.totalRounds}
          totalScore={state.totalScore}
          uplinkToken={state.uplinkToken}
          username={state.username}
        />
      )}

      <CrownNotificationBanner
        demandNotice={state.crownDemandNotice}
        electionResult={state.crownElectionResult}
        hasVoted={state.hasVotedCrown}
        onDismissResult={() => state.setCrownElectionResult(null)}
        onRespondDemand={actions.handleRespondCrownDemand}
        onVote={actions.handleVoteCrown}
        voteNotice={state.crownVoteNotice}
      />

      <ToastContainer onDismiss={removeToast} toasts={toasts} />
    </>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import {
  playChatMessageSound,
  playPlayerJoinedSound,
  playPlayerLeftSound,
  playRemovedFromGameSound
} from '../game/sounds'
import { MAX_CHAT_MESSAGE_LENGTH, type ChatMessageView } from './protocol'

interface ChatProps {
  messages: ChatMessageView[]
  myPlayerId: string
  canSend: boolean
  onSend: (text: string) => void
}

export function Chat({ messages, myPlayerId, canSend, onSend }: ChatProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const lastSeenIdRef = useRef<string | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  // Play a sound per newly-arrived message, keyed by id rather than array
  // length/index so a mid-array truncation (the 200-message history cap)
  // can't miscount and replay a burst of stale sounds. On first mount
  // (rejoining a game with existing history) nothing has been "seen" yet,
  // so the whole backlog is treated as already-seen rather than announced.
  useEffect(() => {
    const lastSeenId = lastSeenIdRef.current
    const lastSeenIndex = lastSeenId === null ? -1 : messages.findIndex((m) => m.id === lastSeenId)
    // No sound for the backlog on first mount (lastSeenId still null) or if
    // the last-seen message fell off the front of the 200-message cap
    // (lastSeenIndex stays -1 either way) - only a genuinely-located
    // last-seen message yields a real "everything after it" slice.
    const newMessages = lastSeenId !== null && lastSeenIndex !== -1 ? messages.slice(lastSeenIndex + 1) : []
    if (messages.length > 0) lastSeenIdRef.current = messages[messages.length - 1].id

    for (const message of newMessages) {
      if (message.kind === 'message') {
        if (message.playerId !== myPlayerId) playChatMessageSound()
      } else if (message.playerId === myPlayerId) {
        if (message.event === 'left') playRemovedFromGameSound()
      } else if (message.event === 'joined') {
        playPlayerJoinedSound()
      } else {
        playPlayerLeftSound()
      }
    }
  }, [messages, myPlayerId])

  const trimmed = draft.trim()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed || !canSend) return
    onSend(trimmed)
    setDraft('')
  }

  return (
    <section className="mp-chat mp-section">
      <h2>Chat</h2>

      <ul className="mp-chat-messages" ref={listRef}>
        {messages.length === 0 && <li className="mp-empty">No messages yet - say hi!</li>}
        {messages.map((message) =>
          message.kind === 'system' ? (
            <li key={message.id} className="mp-chat-system">
              {message.text}
            </li>
          ) : (
            <li
              key={message.id}
              className={'mp-chat-message' + (message.playerId === myPlayerId ? ' mp-chat-message--mine' : '')}
            >
              <span className={`mp-player-dot piece--${message.colorIndex}`} />
              <span className="mp-chat-sender">{message.playerId === myPlayerId ? 'You' : message.playerName}</span>
              <span className="mp-chat-text">{message.text}</span>
            </li>
          )
        )}
      </ul>

      {canSend ? (
        <form className="mp-chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a message..."
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            aria-label="Chat message"
          />
          <button type="submit" disabled={!trimmed} aria-label="Send message">
            <Send size={18} />
          </button>
        </form>
      ) : (
        <p className="mp-empty">You can't send messages in this game anymore.</p>
      )}
    </section>
  )
}

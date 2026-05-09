'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  timestamp: number
  streaming?: boolean
}

// Generate a stable session ID per browser tab (resets on close, persists on reload)
function getSessionId(): string {
  const key = '__hormuz_session_id__'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

// ─── Quick-start pills ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Fleet status summary',
  'Which ship needs attention?',
  'Explain the latest alert',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const sessionId = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialise session ID once on mount
  useEffect(() => {
    sessionId.current = getSessionId()
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const userMessage = text.trim()
    if (!userMessage || isLoading) return

    setInput('')
    setIsLoading(true)

    // Push user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: Date.now() },
    ])

    // Push placeholder AI message (streaming)
    const aiMsgId = Date.now() + 1
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: '', timestamp: aiMsgId, streaming: true },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId: sessionId.current }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          try {
            const parsed = JSON.parse(jsonStr) as
              | { token: string }
              | { done: boolean; timestamp: number }
              | { error: string }

            if ('error' in parsed) {
              accumulated = parsed.error
              break
            }
            if ('token' in parsed) {
              accumulated += parsed.token
              setMessages((prev) =>
                prev.map((m) =>
                  m.timestamp === aiMsgId ? { ...m, content: accumulated } : m,
                ),
              )
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.timestamp === aiMsgId ? { ...m, streaming: false } : m,
        ),
      )
    } catch (err) {
      console.error('[chat] stream error:', err)
      setMessages((prev) =>
        prev.map((m) =>
          m.timestamp === aiMsgId
            ? { ...m, content: 'HORMUZ-AI is temporarily unavailable. Stand by.', streaming: false }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#080c10] font-mono text-sm overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-cyan-900/40 bg-cyan-950/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-[0.25em] text-cyan-400 uppercase">
            HORMUZ-AI // FLEET ADVISOR
          </span>
        </div>
        <div className="text-[9px] text-slate-600 tracking-widest mt-0.5 uppercase">
          Operational intelligence active
        </div>
      </div>

      {/* Message thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="text-slate-600 text-[10px] tracking-widest uppercase mb-1">
              HORMUZ-AI ONLINE
            </div>
            <div className="text-slate-700 text-xs leading-relaxed max-w-[200px] mx-auto">
              Ask me about fleet status, active threats, or operational recommendations.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && messages.at(-1)?.streaming && messages.at(-1)?.content === '' && (
          <div className="flex items-center gap-2 text-cyan-500/70 text-[10px] tracking-wider ml-1">
            <span className="animate-pulse">▋</span>
            <span>HORMUZ-AI is analyzing...</span>
          </div>
        )}
      </div>

      {/* Quick prompts — shown when chat is empty */}
      {messages.length === 0 && (
        <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => void sendMessage(p)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded border border-cyan-900/50 bg-cyan-950/20 text-cyan-400/80
                text-[10px] tracking-wide hover:bg-cyan-900/40 hover:border-cyan-600/50 hover:text-cyan-300
                transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-cyan-900/30 p-3 bg-black/30">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
            placeholder="Enter command or query..."
            rows={1}
            className="flex-1 resize-none bg-slate-900/60 border border-slate-700/50 rounded px-3 py-2
              text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-700/50
              focus:bg-slate-900/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              min-h-[36px] max-h-[80px] overflow-y-auto leading-relaxed"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 px-3 py-2 rounded bg-cyan-900/40 border border-cyan-700/40
              text-cyan-400 text-[10px] font-bold tracking-widest uppercase
              hover:bg-cyan-800/50 hover:border-cyan-500/50 transition-all active:scale-95
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : 'SEND'}
          </button>
        </div>
        <div className="text-[9px] text-slate-700 mt-1.5 tracking-wide">
          ↵ Enter to send  ·  Shift+↵ newline
        </div>
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded bg-slate-800/70 border border-slate-700/40
          text-slate-200 text-xs leading-relaxed">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      {/* AI avatar */}
      <div className="flex-shrink-0 w-5 h-5 rounded bg-cyan-900/50 border border-cyan-700/40
        flex items-center justify-center mt-0.5">
        <span className="text-cyan-400 text-[8px] font-bold">AI</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-cyan-600 tracking-widest mb-1 uppercase">HORMUZ-AI</div>
        <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {msg.content || (msg.streaming ? '' : '—')}
          {msg.streaming && msg.content && (
            <span className="inline-block w-0.5 h-3 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}

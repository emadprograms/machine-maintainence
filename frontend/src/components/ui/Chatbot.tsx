import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  type ChatMessage,
  type QuickReply,
  greeting,
  findBotReply,
  roleQuickReplies,
  newMessage,
} from '../../lib/chatbot';

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    const session = user?.id ?? 'guest';
    if (sessionRef.current !== session) {
      sessionRef.current = session;
      setMessages([]);
      setQuickReplies([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      setQuickReplies(roleQuickReplies(user?.role));
      setMessages([newMessage('bot', greeting(user?.name, user?.role))]);
    }
    inputRef.current?.focus();
  }, [open, user?.name, user?.role, messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  function reply(query: string) {
    const trimmed = query.trim();
    if (!trimmed || typing) return;

    setMessages(prev => [...prev, newMessage('user', trimmed)]);
    setInput('');
    setQuickReplies([]);
    setTyping(true);

    const delay = 400 + Math.min(trimmed.length * 12, 800);
    window.setTimeout(() => {
      setMessages(prev => [...prev, newMessage('bot', findBotReply(trimmed, user?.role))]);
      setTyping(false);
    }, delay);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    reply(input);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="fixed z-[70] bottom-20 left-4 md:bottom-6 md:left-6 flex flex-col items-start gap-3">
        {open && (
          <div
            className="w-[min(100vw-2rem,22rem)] sm:w-96 h-[min(70vh,32rem)] flex flex-col rounded-2xl border border-line-soft bg-surface shadow-apple-lg overflow-hidden animate-scale-in"
            role="dialog"
            aria-label="Assistant MaintainX Pro"
          >
            <header className="flex items-center gap-3 px-4 py-3 border-b border-line-soft bg-gradient-to-r from-brand-600 to-accent-600 text-white shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">Assistant MaintainX</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                  Service client · en ligne
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-white/15 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-canvas/50">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-br-md'
                        : 'bg-surface border border-line-soft text-ink rounded-bl-md shadow-apple-sm'
                    }`}
                  >
                    {msg.text}
                    <p className={`mt-1 text-[10px] ${msg.role === 'user' ? 'text-white/70' : 'text-ink-faint'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-line-soft bg-surface px-4 py-3 shadow-apple-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="h-2 w-2 rounded-full bg-ink-faint animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {quickReplies.length > 0 && !typing && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {quickReplies.map(q => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => reply(q.query)}
                      className="rounded-full border border-line-soft bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line-soft bg-surface p-3 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Posez votre question…"
                className="input flex-1 py-2 text-sm"
                disabled={typing}
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="btn-primary btn-sm shrink-0 rounded-xl !px-3"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-apple-lg transition-all hover:scale-105 active:scale-95 ${
            open
              ? 'bg-surface border border-line-soft text-ink'
              : 'bg-gradient-to-br from-brand-600 to-accent-600 text-white'
          }`}
          aria-label={open ? 'Fermer l\'assistant' : 'Ouvrir l\'assistant'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {!open && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white ring-2 ring-canvas">
              <Sparkles className="h-3 w-3" />
            </span>
          )}
        </button>
      </div>
    </>
  );
}

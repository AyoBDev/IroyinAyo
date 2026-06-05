import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import useStore from '../store.js';
import { getSocket } from '../socket.js';

export default function PublicChat({ marketId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const user = useStore((s) => s.user);
  const messagesEnd = useRef(null);
  const messagesContainer = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (msg) => {
      if (marketId && msg.marketId !== marketId) return;
      if (!marketId && msg.marketId) return;
      setMessages((prev) => [...prev, msg].slice(-100));
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:history', (history) => setMessages(history));
    socket.emit('chat:join', { marketId });

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:history');
      if (marketId) socket.emit('chat:leave', { marketId });
    };
  }, [marketId]);

  useEffect(() => {
    if (messagesContainer.current) {
      messagesContainer.current.scrollTop = messagesContainer.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const socket = getSocket();
    if (!socket) return;

    setSending(true);
    socket.emit('chat:send', { text: input.trim(), marketId });
    setInput('');
    setSending(false);
  }

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden flex flex-col h-[360px]">
      {/* Header */}
      <div className="py-3 px-4 border-b border-line flex items-center gap-2">
        <MessageSquare size={13} className="text-emerald" />
        <h3 className="font-serif text-xs uppercase tracking-wide text-ink-muted">
          Chat
        </h3>
        <span className="text-[10px] text-ink-muted bg-bone py-0.5 px-1.5 rounded-lg ml-auto font-mono">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages */}
      <div ref={messagesContainer} className="flex-1 overflow-auto py-2 px-3 flex flex-col gap-1.5">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-ink-muted text-xs">
              Say something...
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = user && msg.userId === user.id;
            return (
              <div key={msg.id || i} className={`py-2 px-2.5 rounded-md max-w-[90%] ${
                isMe
                  ? 'bg-accent-green-bg border border-accent-green-border self-end'
                  : 'bg-bone border border-transparent self-start'
              }`}>
                {!isMe && (
                  <div className="text-[10px] text-emerald font-semibold mb-0.5">
                    {msg.userName || 'Anon'}
                  </div>
                )}
                <div className="text-xs text-ink break-words">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="py-2.5 px-3 border-t border-line flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          className="flex-1 py-2 px-3 text-xs bg-bone border border-line rounded-md text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className={`py-2 px-3 rounded-md flex items-center justify-center ${
            input.trim() ? 'bg-emerald text-bone' : 'bg-bone text-ink-muted'
          }`}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

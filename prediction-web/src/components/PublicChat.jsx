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
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', height: '360px',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <MessageSquare size={13} color="var(--accent-blue)" />
        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
          Chat
        </h3>
        <span style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '8px',
          marginLeft: 'auto',
        }}>
          {messages.length} msgs
        </span>
      </div>

      {/* Messages */}
      <div ref={messagesContainer} style={{
        flex: 1, overflow: 'auto', padding: '8px 12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Say something...
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = user && msg.userId === user.id;
            return (
              <div key={msg.id || i} style={{
                padding: '8px 10px', borderRadius: 'var(--radius)',
                background: isMe ? 'var(--accent-blue-bg)' : 'var(--bg-secondary)',
                border: isMe ? '1px solid var(--accent-blue-border)' : '1px solid transparent',
                maxWidth: '90%', alignSelf: isMe ? 'flex-end' : 'flex-start',
              }}>
                {!isMe && (
                  <div style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '2px' }}>
                    {msg.userName || 'Anon'}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '10px 12px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '8px',
      }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          style={{
            flex: 1, padding: '9px 12px', fontSize: '12px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius)',
            background: input.trim() ? 'var(--accent-blue)' : 'var(--bg-secondary)',
            color: input.trim() ? '#fff' : 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

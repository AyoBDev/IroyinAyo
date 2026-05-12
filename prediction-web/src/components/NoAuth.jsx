import { TrendingUp, MessageCircle } from 'lucide-react';

export default function NoAuth() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center',
    }}>
      <TrendingUp size={40} color="var(--accent-green)" strokeWidth={2.5} style={{ marginBottom: '20px' }} />
      <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>IroyinMarket</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '340px', marginBottom: '36px', lineHeight: 1.6 }}>
        Predict hackathon winners and football outcomes. Play with points, compete with friends.
      </p>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
        padding: '28px 36px', border: '1px solid var(--border)', textAlign: 'center',
      }}>
        <MessageCircle size={20} color="var(--accent-green)" style={{ marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '12px' }}>
          Send this to the WhatsApp bot:
        </p>
        <p style={{
          fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)',
          padding: '10px 20px', background: 'var(--accent-green-bg)',
          borderRadius: 'var(--radius)', display: 'inline-block',
          border: '1px solid var(--accent-green-border)',
        }}>web</p>
        <p style={{ color: 'var(--text-tertiary)', marginTop: '14px', fontSize: '11px' }}>
          You'll get a personal link to start predicting
        </p>
      </div>
    </div>
  );
}

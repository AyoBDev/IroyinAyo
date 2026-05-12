import { TrendingUp, MessageCircle, ExternalLink } from 'lucide-react';

const BOT_NUMBER = '2347072356504';
const WA_LINK = `https://wa.me/${BOT_NUMBER}?text=web`;

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
        maxWidth: '360px', width: '100%',
      }}>
        <MessageCircle size={20} color="var(--accent-green)" style={{ marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
          Scan the QR code or tap below to get started
        </p>

        {/* QR Code via Google Charts API */}
        <div style={{
          background: '#fff', borderRadius: 'var(--radius-lg)',
          padding: '16px', display: 'inline-block', marginBottom: '16px',
        }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(WA_LINK)}`}
            alt="Scan to open WhatsApp"
            width={180}
            height={180}
            style={{ display: 'block' }}
          />
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '16px' }}>
          Opens WhatsApp with a pre-filled message to our bot
        </p>

        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700,
            background: '#25D366', color: '#fff', textDecoration: 'none',
            width: '100%',
          }}
        >
          Open WhatsApp
          <ExternalLink size={14} />
        </a>

        <p style={{ color: 'var(--text-tertiary)', marginTop: '16px', fontSize: '11px' }}>
          The bot will send you a personal link to start predicting
        </p>
      </div>
    </div>
  );
}

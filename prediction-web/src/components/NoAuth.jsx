export default function NoAuth() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Hackathon Predictions</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '400px', marginBottom: '2rem' }}>
        Get your personal link from the WhatsApp bot to start predicting.
      </p>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)',
        padding: '1.5rem', border: '1px solid var(--border)',
      }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Message the bot:</p>
        <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>web</p>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          to get your prediction link
        </p>
      </div>
    </div>
  );
}

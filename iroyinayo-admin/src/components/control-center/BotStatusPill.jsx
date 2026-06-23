'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BotReconnectDialog } from './BotReconnectDialog';

export function BotStatusPill({ online, lastConnectedAt }) {
  const [dlg, setDlg] = useState(false);
  const label = online === true ? 'Bot online' : online === false ? 'Bot offline' : 'Bot unknown';
  const variant = online === true ? 'default' : online === false ? 'destructive' : 'secondary';
  return (
    <>
      <button onClick={() => setDlg(true)} className="cursor-pointer">
        <Badge variant={variant}>{label}</Badge>
      </button>
      {dlg && (
        <BotReconnectDialog online={online} lastConnectedAt={lastConnectedAt} onClose={() => setDlg(false)} />
      )}
    </>
  );
}

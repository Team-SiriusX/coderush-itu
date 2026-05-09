'use client';

import { useFleetSync } from '@/hooks/use-fleet-sync';
import { getPusherClient } from '@/lib/pusher-client';
import { useFleetStore } from '@/stores/fleet-store';
import { useEffect, useState } from 'react';

const PORTS: Record<string, string> = {
  'KWT-1': 'Kuwait City',
  'BUS-1': 'Bushehr',
  'DMM-1': 'Dammam',
  'BAH-1': 'Manama',
  'DOH-1': 'Doha',
  'AUH-1': 'Abu Dhabi',
  'DXB-1': 'Jebel Ali',
  'BND-1': 'Bandar Abbas',
  'SOH-1': 'Sohar',
  'MCT-1': 'Muscat',
};

type Directive = {
  id: string;
  type: 'HOLD' | 'REROUTE' | 'DIVERT' | 'RETURN_TO_PORT';
  payload: Record<string, unknown>;
  createdAt: number;
};

export default function CaptainDashboard({ shipId }: { shipId: string }) {
  useFleetSync();

  const ships = useFleetStore((s) => s.ships);
  const ship = ships.find((s) => s.id === shipId);

  const [directives, setDirectives] = useState<Directive[]>([]);
  const [distressText, setDistressText] = useState('');
  const [sending, setSending] = useState(false);
  const [distressSent, setDistressSent] = useState(false);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`captain-${shipId}`);
    channel.bind('directive:new', (d: Directive) => {
      setDirectives((prev) => [d, ...prev]);
    });
    return () => pusher.unsubscribe(`captain-${shipId}`);
  }, [shipId]);

  const acceptDirective = async (directiveId: string) => {
    await fetch(`/api/directives/${directiveId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: 'ACCEPT' }),
    });
    setDirectives((prev) => prev.filter((d) => d.id !== directiveId));
  };

  const sendDistress = async () => {
    if (!distressText.trim()) return;
    setSending(true);
    await fetch('/api/distress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipId, message: distressText }),
    });
    setSending(false);
    setDistressSent(true);
    setDistressText('');
    setTimeout(() => setDistressSent(false), 3000);
  };

  if (!ship) {
    return (
      <div className='flex h-screen items-center justify-center bg-slate-950 text-sm text-slate-400'>
        Connecting to fleet...
      </div>
    );
  }

  const fuelPct = Math.min(100, Math.round((ship.fuelRemaining / 8500) * 100));
  const fuelColor =
    fuelPct > 40 ? 'bg-emerald-500' : fuelPct > 20 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className='mx-auto min-h-screen max-w-lg bg-slate-950 p-4 text-slate-100'>
      <div className='mb-6'>
        <div className='mb-1 text-xs uppercase tracking-widest text-slate-500'>Captain View</div>
        <div className='text-2xl font-bold text-slate-100'>{ship.name}</div>
        <div className='text-xs text-slate-500'>
          {ship.id} - {ship.cargo}
        </div>
      </div>

      <div
        className={`mb-4 rounded-lg border p-4 ${
          ship.status === 'normal'
            ? 'border-emerald-700 bg-emerald-950'
            : ship.status === 'arrived'
              ? 'border-slate-700 bg-slate-900'
              : 'border-red-700 bg-red-950'
        }`}
      >
        <div className='mb-1 text-xs uppercase tracking-widest text-slate-400'>Status</div>
        <div className='text-lg font-bold uppercase'>{ship.status.replace(/_/g, ' ')}</div>
        <div className='mt-1 text-xs text-slate-400'>
          Destination: {PORTS[ship.destinationPortId] ?? ship.destinationPortId}
        </div>
      </div>

      <div className='mb-4 rounded-lg border border-slate-800 bg-slate-900 p-4'>
        <div className='mb-2 flex justify-between text-xs'>
          <span className='text-slate-400'>Fuel Remaining</span>
          <span className={fuelPct <= 20 ? 'font-bold text-red-400' : 'text-slate-300'}>
            {Math.round(ship.fuelRemaining).toLocaleString()}t ({fuelPct}%)
          </span>
        </div>
        <div className='h-3 overflow-hidden rounded-full bg-slate-700'>
          <div
            className={`h-full rounded-full transition-all duration-500 ${fuelColor}`}
            style={{ width: `${fuelPct}%` }}
          />
        </div>
        {fuelPct <= 20 && (
          <div className='mt-2 text-xs font-semibold text-red-400'>CRITICAL - Fuel critically low</div>
        )}
      </div>

      <div className='mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs'>
        <InfoRow label='Speed' value={`${ship.speed} knots`} />
        <InfoRow label='Heading' value={`${Math.round(ship.heading)}°`} />
        <InfoRow label='Lat' value={`${ship.position.lat.toFixed(4)}°N`} />
        <InfoRow label='Lng' value={`${ship.position.lng.toFixed(4)}°E`} />
        <InfoRow label='Weather' value={ship.weatherPenalty ? 'Adverse' : 'Clear'} />
        <InfoRow label='Waypoints' value={`${ship.route.length} remaining`} />
      </div>

      {directives.length > 0 && (
        <div className='mb-4 rounded-lg border border-yellow-700 bg-yellow-950 p-4'>
          <div className='mb-2 text-xs font-bold uppercase tracking-widest text-yellow-400'>
            Incoming Directives
          </div>
          {directives.map((d) => (
            <div key={d.id} className='mb-2 flex items-center justify-between'>
              <div>
                <div className='text-sm font-semibold text-yellow-300'>{d.type.replace(/_/g, ' ')}</div>
                <div className='text-xs text-yellow-600'>{new Date(d.createdAt).toLocaleTimeString()}</div>
              </div>
              <button
                onClick={() => acceptDirective(d.id)}
                className='rounded bg-yellow-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yellow-500'
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='rounded-lg border border-slate-800 bg-slate-900 p-4'>
        <div className='mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400'>
          Distress Signal
        </div>
        <textarea
          value={distressText}
          onChange={(e) => setDistressText(e.target.value)}
          placeholder='Describe emergency situation... (AI will extract severity, injuries, systems affected)'
          rows={3}
          className='w-full resize-none rounded border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-red-500 focus:outline-none'
        />
        <button
          onClick={sendDistress}
          disabled={sending || !distressText.trim()}
          className='mt-2 w-full rounded bg-red-700 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-600 disabled:opacity-40'
        >
          {sending ? 'Sending...' : distressSent ? 'Sent' : 'Send Distress Signal'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className='mb-0.5 text-slate-500'>{label}</div>
      <div className='font-medium text-slate-300'>{value}</div>
    </div>
  );
}

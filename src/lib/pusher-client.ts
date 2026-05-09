import Pusher from 'pusher-js';

let client: Pusher | null = null;

function buildPusherClient(): Pusher {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    throw new Error('Missing Pusher client env vars');
  }

  return new Pusher(key, {
    cluster,
  });
}

export function getPusherClient(): Pusher {
  if (!client) {
    client = buildPusherClient();
  }

  return client;
}

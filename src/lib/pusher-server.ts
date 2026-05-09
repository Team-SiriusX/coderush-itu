import Pusher from 'pusher';

let pusher: Pusher | null = null;

function buildPusherServer(): Pusher {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error('Missing Pusher server env vars');
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export function getPusherServer(): Pusher {
  if (!pusher) {
    pusher = buildPusherServer();
  }

  return pusher;
}

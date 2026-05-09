export const SOCKET_EVENTS = {
  // Server → Client
  FLEET_UPDATE: 'fleet:update',
  ALERT_NEW: 'alert:new',
  ALERT_UPDATE: 'alert:update',
  DIRECTIVE_NEW: 'directive:new',
  CAPTAIN_RESPONSE: 'captain:response',
  ZONE_UPDATE: 'zone:update',
  PLAYBACK_FRAME: 'playback:frame',

  // Client → Server
  ZONE_CREATE: 'zone:create',
  ZONE_DELETE: 'zone:delete',
  DIRECTIVE_SEND: 'directive:send',
  CAPTAIN_ACCEPT: 'captain:accept',
  CAPTAIN_DISTRESS: 'captain:distress',
  PLAYBACK_SCRUB: 'playback:scrub',
} as const

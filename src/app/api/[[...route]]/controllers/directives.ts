import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import db from '@/lib/db';
import { getPusherServer } from '@/lib/pusher-server';

const directivesController = new Hono();

const directiveSchema = z.object({
  shipId: z.string(),
  type: z.enum(['REROUTE', 'HOLD', 'DIVERT', 'RETURN_TO_PORT']),
  payload: z.record(z.any()).default({}),
});

directivesController.post('/', zValidator('json', directiveSchema), async (c) => {
  const { shipId, type, payload } = c.req.valid('json');

  try {
    const directive = await db.directive.create({
      data: {
        shipId,
        type,
        payload,
      },
    });

    // Broadcast to the fleet
    const pusherServer = getPusherServer();
    await pusherServer.trigger('fleet-ops', 'new-directive', {
      directive,
    });

    return c.json({ success: true, directive });
  } catch (error) {
    console.error('Failed to create directive:', error);
    return c.json({ message: 'Failed to create directive' }, 500);
  }
});

export default directivesController;

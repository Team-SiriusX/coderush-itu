import { getCookieCache } from 'better-auth/cookies';
import { headers } from 'next/headers';
import db from './db';

/**
 * Retrieves the current authenticated user from the session
 * @returns The user object if authenticated, null otherwise
 */

export async function currentUser() {
  try {
    const data = await getCookieCache(await headers(), {
      secret: process.env.BETTER_AUTH_SECRET,
      strategy: 'jwt',
    });

    if (!data?.user) return null;

    const dbUser = await db.user.findUnique({
      where: { id: data.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        assignedShipId: true,
      },
    });

    return dbUser;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

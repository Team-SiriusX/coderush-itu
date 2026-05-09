import { PrismaClient } from '@prisma/client';
import { auth } from '../src/lib/auth';

const db = new PrismaClient();

async function ensureUser(params: {
  email: string;
  password: string;
  name: string;
  role: 'COMMAND' | 'CAPTAIN';
  assignedShipId?: string;
}) {
  const { email, password, name, role, assignedShipId } = params;

  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (result?.error) {
      throw new Error(result.error.message ?? `Failed to create user ${email}`);
    }
  }

  const createdOrExisting = await db.user.findUnique({ where: { email } });
  if (!createdOrExisting) {
    throw new Error(`User ${email} was not found after sign up.`);
  }

  await db.user.update({
    where: { id: createdOrExisting.id },
    data: {
      role,
      assignedShipId: assignedShipId ?? null,
    },
  });
}

async function main() {
  await ensureUser({
    email: 'command@hormuz.ops',
    password: 'command123',
    name: 'Command Officer',
    role: 'COMMAND',
  });

  await ensureUser({
    email: 'captain@hormuz.ops',
    password: 'captain123',
    name: 'Captain Gharial',
    role: 'CAPTAIN',
    assignedShipId: 'MV-7',
  });

  console.log('[seed] done - command@hormuz.ops / captain@hormuz.ops');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

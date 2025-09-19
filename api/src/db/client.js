import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export { prisma };

export async function disconnectPrisma() {
  try {
    await prisma.();
  } catch (err) {
    // ignore
  }
}

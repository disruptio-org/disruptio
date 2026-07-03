import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  try {
    const users = await p.user.findMany({ select: { email: true, name: true, passwordHash: true } });
    console.log('Users found:', users.length);
    users.forEach(u => console.log(`  - ${u.email} (${u.name}) hash: ${u.passwordHash?.substring(0, 20)}...`));
  } catch (e: any) {
    console.error('DB ERROR:', e.message);
  }
  await p.$disconnect();
}
main();

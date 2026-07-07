import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('disruptio', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@disruptio.org' },
    update: { role: 'superadmin', status: 'active' },
    create: {
      email: 'admin@disruptio.org',
      name: 'Admin',
      passwordHash,
      role: 'superadmin',
      status: 'active',
    },
  });

  // Check if workspace already exists for this user
  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  });

  if (!existingMembership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Disruptio Workspace',
        members: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
    });
    console.log('Seed completed:', { user: user.email, role: user.role, workspace: workspace.name });
  } else {
    console.log('Seed completed:', { user: user.email, role: user.role, workspace: 'existing' });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

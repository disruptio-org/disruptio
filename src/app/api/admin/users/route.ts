import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users
 * List all users. Admin only.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const roleFilter = searchParams.get('role') || '';
  const statusFilter = searchParams.get('status') || '';

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (roleFilter) where.role = roleFilter;
  if (statusFilter) where.status = statusFilter;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          workspace: { select: { name: true } },
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}

/**
 * POST /api/admin/users
 * Create a new user. Admin only.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, name, role, password, workspaceId } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // Validate role
  const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  // Only superadmin can create superadmin/admin users
  if (['superadmin', 'admin'].includes(role) && session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only superadmins can create admin users' }, { status: 403 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: role || 'viewer',
      status: 'active',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  // If workspaceId provided, add to workspace
  if (workspaceId) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: role === 'superadmin' || role === 'admin' ? 'owner' : 'member',
      },
    });
  } else {
    // Add to the first workspace available (default workspace)
    const defaultWorkspace = await prisma.workspace.findFirst();
    if (defaultWorkspace) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: defaultWorkspace.id,
          userId: user.id,
          role: role === 'superadmin' || role === 'admin' ? 'owner' : 'member',
        },
      });
    }
  }

  return NextResponse.json({ user }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isAdmin, isSuperAdmin } from '@/lib/permissions';

/**
 * PATCH /api/admin/users/[userId]
 * Update a user's role, status, or name. Admin only.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { role, status, name } = await req.json();

  // Prevent self-demotion
  if (userId === session.user.id && role && role !== session.user.role) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
  }

  // Prevent self-suspension
  if (userId === session.user.id && status && status !== 'active') {
    return NextResponse.json({ error: 'You cannot suspend or deactivate your own account' }, { status: 400 });
  }

  // Only superadmin can promote to admin/superadmin
  if (role && ['superadmin', 'admin'].includes(role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Only superadmins can assign admin roles' }, { status: 403 });
  }

  // Validate role if provided
  const validRoles = ['superadmin', 'admin', 'editor', 'viewer'];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
  }

  // Validate status if provided
  const validStatuses = ['active', 'suspended', 'deactivated'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  const updateData: any = {};
  if (role) updateData.role = role;
  if (status) updateData.status = status;
  if (name !== undefined) updateData.name = name;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ user });
}

/**
 * DELETE /api/admin/users/[userId]
 * Deactivate a user (soft delete). Admin only.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
  }

  // Check target user exists
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Only superadmin can deactivate admins
  if (['superadmin', 'admin'].includes(target.role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Only superadmins can deactivate admin users' }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'deactivated' },
  });

  return NextResponse.json({ ok: true });
}

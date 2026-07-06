import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/projects/[projectId]/conflicts
 * 
 * Given a user story ID and its impacted files, scan all OTHER user stories
 * in the same project and return any that share the same files.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storyId, files } = await req.json();

  if (!storyId || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ conflicts: [] });
  }

  // Normalize file paths for comparison
  const normalizedFiles = new Set(files.map((f: string) => f.replace(/\\/g, '/').toLowerCase()));

  // Load ALL user stories in this project that have planning data
  const features = await prisma.feature.findMany({
    where: { projectId },
    include: {
      userStories: {
        where: {
          id: { not: storyId },       // exclude the current story
          planning: { not: undefined }, // only stories with planning data
        },
        select: {
          id: true,
          persona: true,
          action: true,
          planning: true,
          feature: { select: { title: true } },
        },
      },
    },
  });

  const conflicts: { storyId: string; storyTitle: string; sharedFiles: string[] }[] = [];

  for (const feature of features) {
    for (const otherStory of feature.userStories) {
      const planning = otherStory.planning as any;
      if (!planning) continue;

      // Collect all files from the other story's planning
      const otherFiles = new Set<string>();

      // From impactedFiles / newFiles
      const otherImpacted = Array.isArray(planning.impactedFiles) ? planning.impactedFiles : [];
      const otherNew = Array.isArray(planning.newFiles) ? planning.newFiles : [];
      [...otherImpacted, ...otherNew].forEach((f: string) => {
        otherFiles.add(f.replace(/\\/g, '/').toLowerCase());
      });

      // From subtask files
      const subtasks = Array.isArray(planning.subtasks) ? planning.subtasks : [];
      for (const st of subtasks) {
        const stFiles = Array.isArray(st.files) ? st.files : [];
        stFiles.forEach((f: string) => otherFiles.add(f.replace(/\\/g, '/').toLowerCase()));
      }

      // Find intersection
      const shared: string[] = [];
      for (const f of otherFiles) {
        if (normalizedFiles.has(f)) {
          // Return the original-case version
          const original = [...otherImpacted, ...otherNew, ...subtasks.flatMap((s: any) => s.files || [])].find(
            (orig: string) => orig.replace(/\\/g, '/').toLowerCase() === f
          );
          shared.push(original || f);
        }
      }

      if (shared.length > 0) {
        const storyTitle = `As a ${otherStory.persona}, I want to ${otherStory.action}`;
        conflicts.push({
          storyId: otherStory.id,
          storyTitle: storyTitle.length > 120 ? storyTitle.slice(0, 120) + '...' : storyTitle,
          sharedFiles: shared,
        });
      }
    }
  }

  return NextResponse.json({
    conflicts,
    totalChecked: features.reduce((acc, f) => acc + f.userStories.length, 0),
  });
}

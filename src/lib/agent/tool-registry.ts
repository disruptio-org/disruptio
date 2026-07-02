import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '@/lib/prisma';

const execAsync = promisify(exec);

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<any>;
}

export const ToolRegistry: Record<string, AgentTool> = {
  // Read DB Schema and verify models without guessing queries
  readDatabaseSchema: {
    name: "readDatabaseSchema",
    description: "Fetches the current Prisma models and active schema parameters.",
    parameters: {},
    execute: async () => {
      try {
        const { stdout } = await execAsync('npx prisma db pull --print');
        return { success: true, schema: stdout };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  },

  // Isolated test executor
  runTestFile: {
    name: "runTestFile",
    description: "Runs a single, specified Vitest file to verify logic in isolation.",
    parameters: {
      testFilePath: "string (absolute or relative path to the target *.test.ts file)"
    },
    execute: async ({ testFilePath }: { testFilePath: string }) => {
      try {
        const { stdout, stderr } = await execAsync(`npx vitest run ${testFilePath}`);
        return { success: true, stdout, stderr };
      } catch (error: any) {
        return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
      }
    }
  },

  // Query project context for agent compilation
  getProjectContext: {
    name: "getProjectContext",
    description: "Fetches the full project configuration context from the database for agent prompt compilation.",
    parameters: {
      projectId: "string (the project ID to fetch context for)"
    },
    execute: async ({ projectId }: { projectId: string }) => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            personas: true,
            guidelines: true,
            technology: true,
            designStyle: true,
            githubConnection: { include: { scans: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
            contextItems: true,
            agents: true,
          },
        });
        if (!project) return { success: false, error: 'Project not found' };
        return { success: true, project };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  },

  // Validate Prisma schema
  validateSchema: {
    name: "validateSchema",
    description: "Runs prisma validate to check schema integrity without applying changes.",
    parameters: {},
    execute: async () => {
      try {
        const { stdout } = await execAsync('npx prisma validate');
        return { success: true, output: stdout || 'Schema is valid' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  },

  // Type check the project
  typeCheck: {
    name: "typeCheck",
    description: "Runs TypeScript type checking without emitting files.",
    parameters: {},
    execute: async () => {
      try {
        const { stdout } = await execAsync('npx tsc --noEmit');
        return { success: true, output: stdout || 'No type errors' };
      } catch (error: any) {
        return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
      }
    }
  },

  // List available tools
  listTools: {
    name: "listTools",
    description: "Returns a list of all available tools with their descriptions and parameters.",
    parameters: {},
    execute: async () => {
      const tools = Object.values(ToolRegistry).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      return { success: true, tools };
    }
  },
};

// Execute a tool by name with arguments
export async function executeTool(toolName: string, args: any = {}): Promise<any> {
  const tool = ToolRegistry[toolName];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}. Available: ${Object.keys(ToolRegistry).join(', ')}` };
  }
  return tool.execute(args);
}

// Get tool definitions for agent system prompts
export function getToolDefinitions(): { name: string; description: string; parameters: Record<string, any> }[] {
  return Object.values(ToolRegistry).map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

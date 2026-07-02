import { describe, it, expect } from 'vitest';
import { ToolRegistry, executeTool, getToolDefinitions } from '../../src/lib/agent/tool-registry';

describe('Agent Tool Registry', () => {
  it('should have all required tools registered', () => {
    expect(ToolRegistry).toHaveProperty('readDatabaseSchema');
    expect(ToolRegistry).toHaveProperty('runTestFile');
    expect(ToolRegistry).toHaveProperty('getProjectContext');
    expect(ToolRegistry).toHaveProperty('validateSchema');
    expect(ToolRegistry).toHaveProperty('typeCheck');
    expect(ToolRegistry).toHaveProperty('listTools');
  });

  it('each tool should have name, description, parameters, and execute', () => {
    for (const [key, tool] of Object.entries(ToolRegistry)) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('getToolDefinitions should return all tools without execute functions', () => {
    const definitions = getToolDefinitions();
    expect(definitions.length).toBe(Object.keys(ToolRegistry).length);
    for (const def of definitions) {
      expect(def).toHaveProperty('name');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('parameters');
      expect(def).not.toHaveProperty('execute');
    }
  });

  it('executeTool should return error for unknown tool', async () => {
    const result = await executeTool('nonExistentTool');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  it('listTools should return all tool definitions', async () => {
    const result = await executeTool('listTools');
    expect(result.success).toBe(true);
    expect(result.tools.length).toBe(Object.keys(ToolRegistry).length);
  });
});

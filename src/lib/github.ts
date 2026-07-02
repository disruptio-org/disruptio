import { Octokit } from '@octokit/rest';

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchUserRepos(token: string) {
  const octokit = createOctokit(token);
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
    type: 'all',
  });

  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    owner: r.owner?.login || '',
    name: r.name,
    description: r.description,
    visibility: r.private ? 'private' : 'public',
    defaultBranch: r.default_branch || 'main',
    language: r.language,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
    permissions: r.permissions,
  }));
}

export async function fetchAuthenticatedUser(token: string) {
  const octokit = createOctokit(token);
  const { data } = await octokit.users.getAuthenticated();
  return { login: data.login, avatarUrl: data.avatar_url, name: data.name };
}

export async function scanRepository(token: string, owner: string, repo: string, branch: string) {
  const octokit = createOctokit(token);

  // 1. Fetch repo metadata
  const { data: repoData } = await octokit.repos.get({ owner, repo });

  // 2. Fetch languages
  const { data: languages } = await octokit.repos.listLanguages({ owner, repo });

  // 3. Fetch file tree (recursive)
  let fileTree: { path: string; type: string }[] = [];
  let fileTreeSummary = '';
  try {
    const { data: treeData } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: 'true' });
    fileTree = (treeData.tree || []).map((item) => ({ path: item.path || '', type: item.type || 'blob' }));
    const dirs = new Set<string>();
    let fileCount = 0;
    for (const item of fileTree) {
      if (item.type === 'blob') fileCount++;
      if (item.path.includes('/')) dirs.add(item.path.split('/')[0]);
    }
    fileTreeSummary = `${fileCount} files, ${dirs.size} top-level directories: ${[...dirs].slice(0, 20).join(', ')}`;
  } catch {
    fileTreeSummary = 'Unable to fetch file tree';
  }

  // 4. Fetch README
  let readmeSummary = '';
  try {
    const { data: readmeData } = await octokit.repos.getReadme({ owner, repo, mediaType: { format: 'raw' } });
    readmeSummary = (typeof readmeData === 'string' ? readmeData : '').substring(0, 2000);
  } catch {
    // No README
  }

  // 5. Detect frameworks
  const filePaths = fileTree.map((f) => f.path);
  const detectedFrameworks: string[] = [];
  const frameworkMap: [string[], string][] = [
    [['package.json'], 'Node.js'],
    [['next.config.js', 'next.config.ts', 'next.config.mjs'], 'Next.js'],
    [['requirements.txt', 'pyproject.toml', 'setup.py'], 'Python'],
    [['Cargo.toml'], 'Rust'],
    [['go.mod'], 'Go'],
    [['pom.xml', 'build.gradle'], 'Java'],
    [['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'], 'Docker'],
    [['prisma/schema.prisma'], 'Prisma'],
    [['tailwind.config.js', 'tailwind.config.ts'], 'Tailwind CSS'],
    [['tsconfig.json'], 'TypeScript'],
    [['vite.config.ts', 'vite.config.js'], 'Vite'],
  ];
  for (const [patterns, name] of frameworkMap) {
    if (patterns.some((p) => filePaths.includes(p))) detectedFrameworks.push(name);
  }
  if (filePaths.some((p) => p.startsWith('.github/workflows/'))) detectedFrameworks.push('GitHub Actions');

  // 6. Important files
  const importantPatterns = [
    'README.md', 'package.json', 'tsconfig.json', '.env.example',
    'prisma/schema.prisma', 'Dockerfile', 'docker-compose.yml',
    'next.config.js', 'next.config.ts', 'next.config.mjs',
  ];
  const importantFiles = filePaths.filter((p) => importantPatterns.includes(p));

  return {
    languages,
    detectedFrameworks,
    fileTreeSummary,
    importantFiles,
    readmeSummary,
    metadata: {
      size: repoData.size,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      visibility: repoData.private ? 'private' : 'public',
      createdAt: repoData.created_at,
      pushedAt: repoData.pushed_at,
      totalFiles: fileTree.filter((f) => f.type === 'blob').length,
    },
  };
}

// Fetch a single file's content from GitHub
export async function fetchFileContent(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  const octokit = createOctokit(token);
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, mediaType: { format: 'raw' } });
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

// Deep scan: reads actual file contents and builds structured codebase understanding
export async function deepScanRepository(token: string, owner: string, repo: string, branch: string) {
  const octokit = createOctokit(token);

  // 1. Get full file tree
  let fileTree: { path: string; type: string; size?: number }[] = [];
  try {
    const { data } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: 'true' });
    fileTree = (data.tree || []).map((item) => ({
      path: item.path || '',
      type: item.type || 'blob',
      size: item.size,
    }));
  } catch {
    return null;
  }

  const filePaths = fileTree.filter((f) => f.type === 'blob').map((f) => f.path);

  // 2. Categorize files by purpose
  const sourceFiles = filePaths.filter((p) => /\.(ts|tsx|js|jsx|py|go|rs|java)$/.test(p) && !p.includes('node_modules'));
  const configFiles = filePaths.filter((p) => /\.(json|yaml|yml|toml|prisma|env|config\.)/.test(p) || p.startsWith('.'));
  const testFiles = filePaths.filter((p) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(p) || p.includes('__tests__'));

  // 3. Identify API routes (Next.js App Router)
  const apiRouteFiles = sourceFiles.filter((p) => p.includes('/api/') && p.includes('route.'));
  const pageFiles = sourceFiles.filter((p) => p.includes('page.') && !p.includes('/api/'));
  const componentFiles = sourceFiles.filter((p) =>
    (p.includes('/components/') || p.includes('/ui/')) && /\.(tsx|jsx)$/.test(p)
  );
  const libFiles = sourceFiles.filter((p) => p.includes('/lib/') || p.includes('/utils/') || p.includes('/helpers/'));

  // 4. Read key file contents (limited to most important files to stay within API limits)
  const filesToRead = [
    'package.json',
    'tsconfig.json',
    'prisma/schema.prisma',
    'next.config.ts', 'next.config.js', 'next.config.mjs',
    'docker-compose.yml', 'docker-compose.yaml',
    'Dockerfile',
    '.env.example',
    'README.md',
    'vitest.config.ts',
    'tailwind.config.ts', 'tailwind.config.js',
  ].filter((f) => filePaths.includes(f));

  // Also read all API route files, lib files, and component files (cap at 40 to avoid rate limits)
  const codeFilesToRead = [
    ...apiRouteFiles,
    ...libFiles,
    ...componentFiles.slice(0, 15),
    ...pageFiles.slice(0, 10),
  ].slice(0, 40);

  const allFilesToRead = [...new Set([...filesToRead, ...codeFilesToRead])];

  const fileContents: Record<string, string> = {};
  const batchSize = 5;
  for (let i = 0; i < allFilesToRead.length; i += batchSize) {
    const batch = allFilesToRead.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (path) => {
        const content = await fetchFileContent(token, owner, repo, path);
        return { path, content };
      })
    );
    for (const { path, content } of results) {
      if (content) {
        // Truncate very large files to 8000 chars
        fileContents[path] = content.length > 8000 ? content.substring(0, 8000) + '\n\n// ... truncated ...' : content;
      }
    }
  }

  // 5. Parse package.json for dependencies
  let dependencies: Record<string, any> = {};
  if (fileContents['package.json']) {
    try {
      const pkg = JSON.parse(fileContents['package.json']);
      dependencies = {
        name: pkg.name,
        version: pkg.version,
        scripts: pkg.scripts || {},
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
      };
    } catch { /* ignore parse errors */ }
  }

  // 6. Parse Prisma schema for DB models
  let databaseModels: Record<string, any> = {};
  const prismaContent = fileContents['prisma/schema.prisma'];
  if (prismaContent) {
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = modelRegex.exec(prismaContent)) !== null) {
      const modelName = match[1];
      const body = match[2];
      const fields = body.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
        .map((l) => {
          const parts = l.split(/\s+/);
          return { name: parts[0], type: parts[1] || 'unknown' };
        })
        .filter((f) => f.name && !f.name.startsWith('@'));
      databaseModels[modelName] = { fieldCount: fields.length, fields };
    }
  }

  // 7. Analyze API routes
  const apiRoutes: Record<string, any>[] = [];
  for (const routePath of apiRouteFiles) {
    const content = fileContents[routePath];
    if (!content) continue;
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(
      (m) => content.includes(`export async function ${m}`) || content.includes(`export function ${m}`)
    );
    // Extract the route path from file path (e.g., src/app/api/projects/[projectId]/route.ts -> /api/projects/[projectId])
    const apiPath = routePath
      .replace(/^src\/app/, '')
      .replace(/\/route\.(ts|js)$/, '')
      .replace(/\\/g, '/');
    apiRoutes.push({ path: apiPath, methods, file: routePath });
  }

  // 8. Analyze components
  const components: Record<string, any>[] = [];
  for (const compPath of componentFiles) {
    const content = fileContents[compPath];
    if (!content) continue;
    const nameMatch = content.match(/(?:export default function|export function|function)\s+(\w+)/);
    const hasState = content.includes('useState');
    const hasEffect = content.includes('useEffect');
    const hasRouter = content.includes('useRouter');
    const hasFetch = content.includes('fetch(');
    const propsMatch = content.match(/\{\s*([^}]+)\s*\}\s*:\s*\{/);
    components.push({
      file: compPath,
      name: nameMatch?.[1] || compPath.split('/').pop()?.replace(/\.\w+$/, ''),
      isClient: content.includes("'use client'"),
      hasState, hasEffect, hasRouter, hasFetch,
      estimatedComplexity: (hasState ? 1 : 0) + (hasEffect ? 1 : 0) + (hasFetch ? 2 : 0) + (content.split('\n').length > 100 ? 1 : 0),
    });
  }

  // 9. Build architecture understanding
  const dirs = new Set<string>();
  for (const f of filePaths) {
    if (f.includes('/')) dirs.add(f.split('/').slice(0, 2).join('/'));
  }

  const architecture = {
    pattern: apiRouteFiles.length > 0 ? 'Next.js App Router' : pageFiles.some((p) => p.includes('pages/')) ? 'Next.js Pages Router' : 'Unknown',
    totalFiles: filePaths.length,
    sourceFiles: sourceFiles.length,
    apiRouteCount: apiRouteFiles.length,
    componentCount: componentFiles.length,
    pageCount: pageFiles.length,
    libCount: libFiles.length,
    testCount: testFiles.length,
    topLevelDirs: [...dirs].sort(),
    hasDocker: filePaths.includes('Dockerfile') || filePaths.includes('docker-compose.yml'),
    hasCI: filePaths.some((p) => p.startsWith('.github/workflows/')),
    hasPrisma: filePaths.includes('prisma/schema.prisma'),
    hasTests: testFiles.length > 0,
  };

  // 10. Build file index
  const fileIndex = filePaths.map((p) => {
    const ext = p.split('.').pop() || '';
    let category = 'other';
    if (apiRouteFiles.includes(p)) category = 'api-route';
    else if (componentFiles.includes(p)) category = 'component';
    else if (pageFiles.includes(p)) category = 'page';
    else if (libFiles.includes(p)) category = 'lib';
    else if (testFiles.includes(p)) category = 'test';
    else if (configFiles.includes(p)) category = 'config';
    return { path: p, ext, category, size: fileTree.find((f) => f.path === p)?.size || 0 };
  });

  // 11. Build summaries
  const techStackSummary = [
    dependencies.dependencies ? `Runtime: ${Object.keys(dependencies.dependencies).join(', ')}` : '',
    dependencies.devDependencies ? `Dev: ${Object.keys(dependencies.devDependencies).join(', ')}` : '',
    Object.keys(databaseModels).length > 0 ? `DB Models: ${Object.keys(databaseModels).join(', ')}` : '',
    `API Routes: ${apiRoutes.length}`,
    `Components: ${components.length}`,
    `Pages: ${pageFiles.length}`,
  ].filter(Boolean).join('\n');

  const architectureSummary = [
    `Architecture: ${architecture.pattern}`,
    `${architecture.totalFiles} files total (${architecture.sourceFiles} source, ${architecture.testCount} tests)`,
    `${architecture.apiRouteCount} API routes, ${architecture.componentCount} components, ${architecture.pageCount} pages`,
    architecture.hasPrisma ? `Database: Prisma ORM with ${Object.keys(databaseModels).length} models` : '',
    architecture.hasDocker ? 'Containerized with Docker' : '',
    architecture.hasCI ? 'CI/CD via GitHub Actions' : '',
    architecture.hasTests ? `Test suite: ${architecture.testCount} test files` : 'No test suite detected',
  ].filter(Boolean).join('\n');

  return {
    architecture,
    fileIndex,
    dependencies,
    apiRoutes,
    components,
    databaseModels,
    configFiles: filesToRead,
    testStructure: {
      testFiles,
      testCount: testFiles.length,
      hasVitest: filePaths.includes('vitest.config.ts') || filePaths.includes('vitest.config.js'),
      hasJest: filePaths.includes('jest.config.ts') || filePaths.includes('jest.config.js'),
      hasPlaywright: filePaths.includes('playwright.config.ts'),
    },
    fileContents,
    techStackSummary,
    architectureSummary,
  };
}

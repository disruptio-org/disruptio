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

# Procedural Skill: Prisma Migration Protocol

When modifying the database schema, you must strictly follow these rules:
1. Always run a dry run scan using `npx prisma validate`.
2. Wrap any schema additions in raw transaction boundaries when executing seeds.
3. Verify the foreign keys of the Workspace ownership chain: User -> WorkspaceMember -> Workspace -> Project.
4. Never generate migration files without a descriptive name parameter.

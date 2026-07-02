# Procedural Skill: Design System Compliance

When editing, creating, or compiling UI elements, you must strictly follow these rules:
1. **Dark mode only** — Pure black/near-black backgrounds (`#000000`, `#0A0A0A`), crisp white text.
2. **Accent color** — Disruptio Red (`#FF2A2A` or `#FF0000`) used sparingly for primary actions and active states.
3. **No generic SaaS blue** — `#3B82F6` and similar default blues are banned.
4. **Sharp borders** — Use `rounded-none` or `rounded-sm`. No over-rounded "friendly startup" components.
5. **No light mode** — No toggleable light-mode interfaces.
6. **Typography** — Clean sans-serif primary text; monospaced fonts (JetBrains Mono) for technical data.
7. **Secondary surfaces** — Dark charcoal cards (`#121212`, `#1A1A1A`) with thin dark gray borders.
8. **Form states** — Every input must support disabled, validation, loading, and error/success border states.

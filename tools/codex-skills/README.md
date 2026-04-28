# Codex Skill Installer in TSX

This replaces the Python examples with a TypeScript CLI that runs through `tsx`.

## Commands

List curated skills:

```bash
npx -y tsx tools/codex-skills/codex-skill.ts list
```

Install a curated skill from `openai/skills`:

```bash
npx -y tsx tools/codex-skills/codex-skill.ts install \
  --repo openai/skills \
  --path skills/.curated/<skill-name>
```

Install from a GitHub URL:

```bash
npx -y tsx tools/codex-skills/codex-skill.ts install \
  --url https://github.com/<owner>/<repo>/tree/<ref>/<path-to-skill>
```

List experimental skills:

```bash
npx -y tsx tools/codex-skills/codex-skill.ts list \
  --path skills/.experimental
```

## Notes

- Default install destination is `~/.codex/skills/<skill-name>`.
- Authentication uses `GITHUB_TOKEN` or `GH_TOKEN` if set.
- Download mode uses GitHub zip downloads and `unzip`; git fallback uses sparse checkout.
- Restart Codex after installing a skill so it gets picked up.

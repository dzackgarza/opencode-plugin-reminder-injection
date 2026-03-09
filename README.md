# skill-reminder-injection

OpenCode plugin that injects a short skill reminder into each user message.

It scans skill directories for `SKILL.md`, caches each skill name and description,
embeds the current prompt with the cached skills, and appends a synthetic text
part telling the agent to consider the top 3 relevant skills by name.

## Configuration

Add the plugin to your OpenCode config:

```json
{
  "plugin": ["file:///home/dzack/opencode-plugins/skill-reminder-injection/src/index.ts"]
}
```

Optional environment variables:

- `SKILL_REMINDER_SKILLS_DIRS`: colon-separated list of skill roots to scan.
- `SKILL_REMINDER_MODEL`: embedding model name.
- `SKILL_REMINDER_TOP_K`: number of skills to inject. Default: `3`.

Default skill root:

- `~/.config/opencode/skills`

Default model:

- `mixedbread-ai/mxbai-embed-xsmall-v1`

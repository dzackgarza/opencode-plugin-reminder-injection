

# opencode-plugin-reminder-injection

This OpenCode plugin injects skill reminders into user messages.

The plugin scans directories for `SKILL.md` files to cache their names and descriptions. It then embeds the prompt with the cached skills and instructs the agent to use the most relevant ones.

## Configuration

Add the plugin to your OpenCode config:

```json
{
  "plugin": ["file:///path/to/opencode-plugin-reminder-injection/src/index.ts"]
}
```

Optional environment variables:

- `REMINDER_INJECTION_SKILLS_DIRS`: colon-separated list of skill roots to scan.
- `REMINDER_INJECTION_MODEL`: embedding model name.
- `REMINDER_INJECTION_TOP_K`: number of skills to inject. Default: `3`.

Default skill root:

- `~/.config/opencode/skills`

Default model:

- `mixedbread-ai/mxbai-embed-xsmall-v1`

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I57UKJ8)


# skill-reminder-injection

This OpenCode plugin injects skill reminders into user messages.

The plugin scans directories for `SKILL.md` files to cache their names and descriptions. It then embeds the prompt with the cached skills and instructs the agent to use the most relevant ones.

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

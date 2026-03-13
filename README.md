[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I57UKJ8)



# opencode-plugin-reminder-injection

This OpenCode plugin injects skill reminders into user messages.

The plugin scans directories for `SKILL.md` files to cache their names and descriptions. It then embeds the prompt with the cached skills and instructs the agent to use the most relevant ones.

## Configuration

Repo-local verification uses [`.envrc`](./.envrc), [`.config/opencode.json`](./.config/opencode.json), and a checked-in symlink under [`.config/plugins`](./.config/plugins) so OpenCode loads the real exporter without a machine-specific `file://` path.

## Environment Variables

| Name | Required | Default | Controls |
|------|----------|---------|---------|
| `REMINDER_INJECTION_SKILLS_DIRS` | No | `~/.config/opencode/skills` | Colon-separated list of directories to scan for `SKILL.md` files |
| `REMINDER_INJECTION_MODEL` | No | `mixedbread-ai/mxbai-embed-xsmall-v1` | Embedding model name |
| `REMINDER_INJECTION_TOP_K` | No | `3` | Number of top skills to inject |
| `REMINDER_INJECTION_TEST_PASSPHRASE` | No | — | Passphrase for integration test liveness proof |

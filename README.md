[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I57UKJ8)



# opencode-plugin-reminder-injection

This OpenCode plugin injects skill reminders into user messages.

The plugin scans directories for `SKILL.md` files to cache their names and descriptions. It then embeds the prompt with the cached skills and instructs the agent to use the most relevant ones.

## Features

- Passive `chat.message` hook — no tool invocation required
- Semantic skill matching via cosine similarity on local embeddings (`mxbai-embed-xsmall-v1`)
- Scans any number of skill directories, configurable via `REMINDER_INJECTION_SKILLS_DIRS`
- Injects top-K skill summaries as a synthetic text part appended to the outgoing message

## Agent Surface

This plugin uses a `chat.message` hook — it exposes no tool names to the agent. On every user message, it:

1. Scans `REMINDER_INJECTION_SKILLS_DIRS` for `SKILL.md` files (cached in memory)
2. Embeds the user message and computes cosine similarity against skill descriptions
3. Appends the top-K skill names and descriptions as a synthetic text part at the end of the outgoing message

The agent sees the injected text as part of the user turn. No additional tool call is required.

## Configuration

Repo-local verification uses [`.envrc`](./.envrc), [`.config/opencode.json`](./.config/opencode.json), and a checked-in symlink under [`.config/plugins`](./.config/plugins) so OpenCode loads the real exporter without a machine-specific `file://` path.

## Environment Variables

| Name | Required | Default | Controls |
|------|----------|---------|---------|
| `REMINDER_INJECTION_SKILLS_DIRS` | No | `~/.config/opencode/skills` | Colon-separated list of directories to scan for `SKILL.md` files |
| `REMINDER_INJECTION_MODEL` | No | `mixedbread-ai/mxbai-embed-xsmall-v1` | Embedding model name |
| `REMINDER_INJECTION_TOP_K` | No | `3` | Number of top skills to inject |
| `REMINDER_INJECTION_TEST_PASSPHRASE` | No | — | Passphrase for integration test liveness proof |

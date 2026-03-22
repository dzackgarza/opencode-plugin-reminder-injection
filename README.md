[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I57UKJ8)



# opencode-plugin-reminder-injection

This OpenCode plugin injects skill reminders into user messages.

The plugin scans directories for `SKILL.md` files to cache their names and descriptions. It then embeds the prompt with the cached skills and instructs the agent to use the most relevant ones.

## Features

- Passive `experimental.chat.messages.transform` hook — no tool invocation required
- Semantic skill matching via cosine similarity on local embeddings (`mxbai-embed-xsmall-v1`)
- Scans any number of skill directories, configurable via `REMINDER_INJECTION_SKILLS_DIRS`
- Injects top-K skill summaries into the outgoing user message before model execution

## Agent Surface

This plugin uses `experimental.chat.messages.transform` — it exposes no tool names to the agent. On every user message, it:

1. Scans `REMINDER_INJECTION_SKILLS_DIRS` for `SKILL.md` files (cached in memory)
2. Embeds the user message and computes cosine similarity against skill descriptions
3. Appends the top-K skill names and descriptions onto the outgoing user text before the model sees it

The agent sees the injected text as part of the user turn. No additional tool call is required.

## Configuration

Repo-root [`opencode.json`](./opencode.json) is the canonical proof config for this repo. CI starts `opencode serve` from the repo root and relies on standard global-plus-project config precedence.

## Environment Variables

| Name | Required | Default | Controls |
|------|----------|---------|---------|
| `REMINDER_INJECTION_SKILLS_DIRS` | No | `~/.config/opencode/skills` | Colon-separated list of directories to scan for `SKILL.md` files |
| `REMINDER_INJECTION_MODEL` | No | `mixedbread-ai/mxbai-embed-xsmall-v1` | Embedding model name |
| `REMINDER_INJECTION_TOP_K` | No | `3` | Number of top skills to inject |
| `REMINDER_INJECTION_TEST_PASSPHRASE` | No | — | Passphrase for integration test liveness proof |

## Checks

```bash
direnv allow .
just typecheck
just test
```

CI is the canonical proof environment. For local debugging, start a repo-local OpenCode server from this checkout, set `OPENCODE_BASE_URL`, and then run the same `just` entrypoints.

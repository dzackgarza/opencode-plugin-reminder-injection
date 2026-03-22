/**
 * Integration tests for opencode-plugin-reminder-injection.
 *
 * The plugin hooks into experimental.chat.messages.transform and appends a
 * skill-reminder block onto the outgoing user text before model execution.
 * The witness token appears as the name of a fixture skill that is indexed by
 * the skill-suggester CLI when SKILL_REMINDER_SKILLS_DIRS points to the
 * fixture directory.
 *
 * Proof surface: the witness token from the injected reminder appears in the
 * model's final assistant text.
 */

import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const BASE_URL = process.env.OPENCODE_BASE_URL;
if (!BASE_URL) {
  throw new Error('OPENCODE_BASE_URL must be set (run against a repo-local or CI OpenCode server)');
}

const AGENT_NAME = 'plugin-proof';
const PROJECT_DIR = process.cwd();

const WITNESS = process.env.REMINDER_INJECTION_TEST_WITNESS?.trim();
if (!WITNESS) throw new Error('REMINDER_INJECTION_TEST_WITNESS must be set (sourced from plugin .envrc)');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANAGER_PACKAGE = 'git+https://github.com/dzackgarza/opencode-manager.git';
const MAX_BUFFER = 8 * 1024 * 1024;
const SESSION_TIMEOUT_MS = 240_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runOcm(args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(
    'uvx',
    ['--from', MANAGER_PACKAGE, 'ocm', ...args],
    {
      env: { ...process.env, OPENCODE_BASE_URL: BASE_URL },
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      timeout: SESSION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    },
  );
  if (result.error) throw result.error;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (result.status !== 0) {
    throw new Error(`ocm ${args.join(' ')} failed\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
  return { stdout, stderr };
}

function beginSession(prompt: string): string {
  const { stdout } = runOcm(['begin-session', prompt, '--agent', AGENT_NAME, '--json']);
  const data = JSON.parse(stdout) as { sessionID: string };
  if (!data.sessionID) throw new Error(`begin-session returned no sessionID: ${stdout}`);
  return data.sessionID;
}

function waitIdle(sessionID: string): void {
  runOcm(['wait', sessionID, '--timeout-sec=180']);
}

function readFinalAssistantText(sessionID: string): string {
  const { stdout } = runOcm(['transcript', sessionID, '--json']);
  const data = JSON.parse(stdout) as {
    turns: Array<{
      assistantMessages: Array<{
        steps: Array<{ type: string; contentText?: string } | null>;
      }>;
    }>;
  };
  const parts = data.turns.flatMap((turn) =>
    turn.assistantMessages.flatMap((msg) =>
      (msg.steps ?? [])
        .filter((s): s is { type: string; contentText: string } =>
          s !== null && s.type === 'text' && typeof s.contentText === 'string',
        )
        .map((s) => s.contentText),
    ),
  );
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reminder-injection plugin integration', () => {
  it('proves skill reminder is injected and witness token appears in assistant text', () => {
    // Prompt about reminder hook testing — designed to match the RIHOOK-PROOF-20260318 fixture skill.
    // The plugin injects a synthetic text part listing the matched skill name.
    // Instruct the model to echo back any "Skill reminder" content it sees.
    const prompt =
      'I need to test reminder hook injection and skill suggestion verification. ' +
      'If you see any "Skill reminder:" section in your context, echo back verbatim ' +
      'the skill names listed in it. Otherwise reply with NO_REMINDER.';

    const sessionID = beginSession(prompt);
    try {
      waitIdle(sessionID);
      const text = readFinalAssistantText(sessionID);
      // The witness token is the fixture skill name injected by the plugin.
      // If the hook fired and skill-suggester found the fixture skill, the
      // model will echo it. This proves the injection pipeline is wired end-to-end.
      expect(text).toContain(WITNESS);
    } finally {
      try { runOcm(['delete', sessionID]); } catch { /* best-effort */ }
    }
  }, SESSION_TIMEOUT_MS);
});

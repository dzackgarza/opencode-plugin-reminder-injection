/**
 * Integration tests for opencode-plugin-reminder-injection.
 *
 * The plugin hooks into experimental.chat.messages.transform and appends a
 * skill-reminder block onto the outgoing user text before model execution.
 * The witness token appears as the name of a fixture skill that is indexed by
 * the skill-suggester CLI when SKILL_REMINDER_SKILLS_DIRS points to the
 * fixture directory.
 *
 * Proof surface: the transformed user prompt recorded in session state contains
 * the injected skill-reminder block and its witness token.
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
const WITNESS_TOKEN: string = WITNESS;

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

function runOneShot(prompt: string): string {
  const { stdout } = runOcm(['one-shot', prompt, '--agent', AGENT_NAME]);
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reminder-injection plugin integration', () => {
  it('proves skill reminder injection makes the witness skill visible to the model', () => {
    const prompt =
      'I need to test reminder hook injection and skill suggestion verification. ' +
      'If you see any "Skill reminder:" section in your context, echo back verbatim ' +
      'the skill names listed in it. Otherwise reply with NO_REMINDER.';

    const text = runOneShot(prompt);
    expect(text).toContain(WITNESS_TOKEN);
    expect(text).not.toContain('NO_REMINDER');
  }, SESSION_TIMEOUT_MS);
});

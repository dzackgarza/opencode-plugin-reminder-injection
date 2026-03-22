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

import { afterAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
const REMINDER_TIMEOUT_MS = 120_000;
const OCM_TOOL_DIR = mkdtempSync(join(tmpdir(), 'ocm-tool-'));
let ocmBinaryPath: string | undefined;

afterAll(() => {
  rmSync(OCM_TOOL_DIR, { recursive: true, force: true });
});

function getOcmBinaryPath(): string {
  if (ocmBinaryPath) return ocmBinaryPath;
  const binDir = process.platform === 'win32' ? join(OCM_TOOL_DIR, 'Scripts') : join(OCM_TOOL_DIR, 'bin');
  const candidate = join(binDir, process.platform === 'win32' ? 'ocm.exe' : 'ocm');
  const pythonBinary = join(binDir, process.platform === 'win32' ? 'python.exe' : 'python');
  if (!existsSync(candidate)) {
    const createVenv = spawnSync('uv', ['venv', OCM_TOOL_DIR], {
      env: process.env,
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      timeout: SESSION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    if (createVenv.error) throw createVenv.error;
    if (createVenv.status !== 0) {
      throw new Error(
        `Failed to create ocm venv\nSTDOUT:\n${createVenv.stdout ?? ''}\nSTDERR:\n${createVenv.stderr ?? ''}`,
      );
    }
    const install = spawnSync(
      'uv',
      ['pip', 'install', '--python', pythonBinary, MANAGER_PACKAGE],
      {
        env: process.env,
        cwd: PROJECT_DIR,
        encoding: 'utf8',
        timeout: SESSION_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
      },
    );
    if (install.error) throw install.error;
    if (install.status !== 0 || !existsSync(candidate)) {
      throw new Error(
        `Failed to install ocm\nSTDOUT:\n${install.stdout ?? ''}\nSTDERR:\n${install.stderr ?? ''}`,
      );
    }
  }
  ocmBinaryPath = candidate;
  return candidate;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runOcm(args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(
    getOcmBinaryPath(),
    args,
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

type TranscriptData = {
  turns: Array<{
    userPrompt: string;
  }>;
};

function readTranscript(sessionID: string): TranscriptData {
  const result = spawnSync(
    getOcmBinaryPath(),
    ['transcript', sessionID, '--json'],
    {
      env: { ...process.env, OPENCODE_BASE_URL: BASE_URL },
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      timeout: SESSION_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    },
  );
  if (result.error) throw result.error;
  const stdout = result.stdout?.trim() ?? '';
  if (!stdout) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(`ocm transcript ${sessionID} returned no JSON\nSTDERR:\n${stderr}`);
  }
  return JSON.parse(stdout) as TranscriptData;
}

async function waitForReminderPrompt(sessionID: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = readTranscript(sessionID).turns
      .map((turn) => turn.userPrompt?.trim() ?? '')
      .find(
        (text) =>
          text.includes('Skill reminder: consider using these relevant skills before proceeding.') &&
          text.includes(WITNESS_TOKEN),
      );
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for injected reminder text in session ${sessionID}.`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reminder-injection plugin integration', () => {
  it('proves the outgoing user prompt is transformed to include the witness skill reminder', async () => {
    const prompt =
      'I need to test reminder hook injection and skill suggestion verification. ' +
      'Use whatever skills are relevant.';

    const sessionID = beginSession(prompt);
    try {
      const text = await waitForReminderPrompt(sessionID, REMINDER_TIMEOUT_MS);
      expect(text).toContain('Skill reminder: consider using these relevant skills before proceeding.');
      expect(text).toContain(WITNESS_TOKEN);
      expect(text).toContain('Use them if they materially match the task.');
    } finally {
      try { runOcm(['delete', sessionID]); } catch { /* best-effort */ }
    }
  }, REMINDER_TIMEOUT_MS);
});

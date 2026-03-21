import type { Plugin } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TOP_K = Math.max(
  1,
  Number.parseInt(process.env.REMINDER_INJECTION_TOP_K ?? '3', 10) || 3,
);
const REMINDER_TAG = 'opencode-plugin-reminder-injection';
const CLI_TIMEOUT_MS = 60_000;
const CLI_SPEC =
  process.env.SKILL_SUGGESTER_CLI_SPEC ??
  'git+https://github.com/dzackgarza/reminder-manager.git';

async function runSkillSuggester(
  prompt: string,
): Promise<Array<{ name: string; description: string }>> {
  const { stdout } = await execFileAsync(
    'uvx',
    [
      '--from',
      CLI_SPEC,
      'skill-suggester',
      'top-skills',
      prompt,
      '--top-k',
      String(TOP_K),
    ],
    {
      timeout: CLI_TIMEOUT_MS,
    },
  );
  return JSON.parse(stdout);
}

function textParts(parts: Part[]): string[] {
  return parts
    .filter(
      (part): part is Extract<Part, { type: 'text'; text: string }> =>
        part.type === 'text',
    )
    .map((part) => part.text.trim())
    .filter(Boolean);
}

function reminderText(skills: { name: string; description: string }[]): string {
  const lines = [
    'Skill reminder: consider using these relevant skills before proceeding.',
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
    'Use them if they materially match the task.',
  ];
  return lines.join('\n');
}

function buildSyntheticTextPart(
  sessionID: string,
  messageID: string,
  text: string,
): Extract<Part, { type: 'text' }> {
  return {
    id: `part_skill_reminder_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sessionID,
    messageID,
    type: 'text',
    text,
    synthetic: true,
    metadata: {
      source: REMINDER_TAG,
    },
  };
}

export function createSkillReminderPlugin(): Plugin {
  return async () => ({
    'chat.message': async (_input, output) => {
      const prompt = textParts(output.parts).join('\n\n').trim();
      if (!prompt) return;
      try {
        const skills = await runSkillSuggester(prompt);
        if (skills.length === 0) return;
        output.parts.push(
          buildSyntheticTextPart(
            output.message.sessionID,
            output.message.id,
            reminderText(skills),
          ),
        );
      } catch (error) {
        console.error('Reminder injection error:', error);
      }
    },
  });
}

export const SkillReminderInjectionPlugin = createSkillReminderPlugin();

export default SkillReminderInjectionPlugin;

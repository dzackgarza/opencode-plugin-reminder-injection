import type { Plugin } from '@opencode-ai/plugin';
import type { Message, Part, TextPart } from '@opencode-ai/sdk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TOP_K = Math.max(
  1,
  Number.parseInt(process.env.REMINDER_INJECTION_TOP_K ?? '3', 10) || 3,
);
const CLI_TIMEOUT_MS = 60_000;
const CLI_SPEC =
  process.env.SKILL_SUGGESTER_CLI_SPEC ??
  'git+https://github.com/dzackgarza/reminder-manager.git';

type MessageWithParts = {
  info: Message;
  parts: Part[];
};

function skillSuggesterCommand(spec: string): [string, string[]] {
  if (spec.startsWith('/') || spec.startsWith('.')) {
    return ['uv', ['run', '--project', spec, 'skill-suggester']];
  }
  return ['uvx', ['--from', spec, 'skill-suggester']];
}

async function runSkillSuggester(
  prompt: string,
): Promise<Array<{ name: string; description: string }>> {
  const [command, baseArgs] = skillSuggesterCommand(CLI_SPEC);
  const { stdout } = await execFileAsync(
    command,
    [
      ...baseArgs,
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

function textParts(parts: Part[]): TextPart[] {
  return parts.filter((part): part is TextPart => part.type === 'text');
}

function reminderText(skills: { name: string; description: string }[]): string {
  const lines = [
    'Skill reminder: consider using these relevant skills before proceeding.',
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
    'Use them if they materially match the task.',
  ];
  return lines.join('\n');
}

function lastUserMessage(messages: MessageWithParts[]): MessageWithParts | undefined {
  return [...messages].reverse().find((message) => message.info.role === 'user');
}

export function createSkillReminderPlugin(): Plugin {
  return async ({ client }) => ({
    'experimental.chat.messages.transform': async (_input, output) => {
      const message = lastUserMessage(output.messages);
      if (!message) return;
      const messageTextParts = textParts(message.parts);
      const prompt = messageTextParts.map((part) => part.text.trim()).filter(Boolean).join('\n\n');
      if (!prompt) return;
      try {
        const skills = await runSkillSuggester(prompt);
        if (skills.length === 0) return;
        const lastTextPart = messageTextParts.at(-1);
        if (!lastTextPart) return;
        lastTextPart.text = `${lastTextPart.text.trim()}\n\n${reminderText(skills)}`;
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        await client.app
          .log({
            body: {
              service: 'opencode-plugin-reminder-injection',
              level: 'error',
              message: 'Error in messages transform',
              extra: { error },
            },
          })
          .catch(() => {});
      }
    },
  });
}

export const SkillReminderInjectionPlugin = createSkillReminderPlugin();

export default SkillReminderInjectionPlugin;

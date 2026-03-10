import type { Plugin } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { SkillCache } from "./skill-cache.ts";

const TOP_K = Math.max(1, Number.parseInt(process.env.REMINDER_INJECTION_TOP_K ?? "3", 10) || 3);
const REMINDER_TAG = "opencode-plugin-reminder-injection";

function textParts(parts: Part[]): string[] {
  return parts
    .filter((part): part is Extract<Part, { type: "text"; text: string }> => part.type === "text")
    .map((part) => part.text.trim())
    .filter(Boolean);
}

function reminderText(skills: { name: string; description: string }[]): string {
  const lines = [
    "Skill reminder: consider using these relevant skills before proceeding.",
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
    "Use them if they materially match the task.",
  ];
  return lines.join("\n");
}

function buildSyntheticTextPart(sessionID: string, messageID: string, text: string): Extract<Part, { type: "text" }> {
  return {
    id: `part_skill_reminder_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sessionID,
    messageID,
    type: "text",
    text,
    synthetic: true,
    metadata: {
      source: REMINDER_TAG,
    },
  };
}

export function createSkillReminderPlugin(cache = new SkillCache()): Plugin {
  return async () => ({
    "chat.message": async (_input, output) => {
      const prompt = textParts(output.parts).join("\n\n").trim();
      if (!prompt) return;
      const skills = await cache.topSkillsForPrompt(prompt, TOP_K);
      if (skills.length === 0) return;
      output.parts.push(buildSyntheticTextPart(output.message.sessionID, output.message.id, reminderText(skills)));
    },
  });
}

export const SkillReminderInjectionPlugin = createSkillReminderPlugin();

export default SkillReminderInjectionPlugin;

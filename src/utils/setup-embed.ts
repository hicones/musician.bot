import { EmbedBuilder } from "discord.js";
import type { SetupStep } from "../models/setup.model";

export const createStepEmbed = (
  title: string,
  steps: SetupStep[],
  isCompleted: boolean,
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(isCompleted ? 0x00ff00 : 0xffa500)
    .setDescription(
      steps
        .map(
          (step) =>
            `${step.success ? "✅" : "❌"} **${step.name}**${
              step.error ? ` - ${step.error}` : ""
            }${step.duration ? ` (${step.duration}ms)` : ""}`,
        )
        .join("\n"),
    )
    .setTimestamp();

  return embed;
};
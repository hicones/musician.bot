import { Interaction, ChatInputCommandInteraction } from "discord.js";
import { MusicManager } from "../music/music-manager";
import { handleSetupCommand } from "../commands/setup.js";
import { handleButtonInteraction } from "./button-handlers.js";
import { handleModalInteraction } from "./modal-handlers.js";
import { handleSelectInteraction } from "./select-handlers.js";

export const handleInteraction = async (
  interaction: Interaction,
  musicManager: MusicManager,
) => {
  if (!interaction.guildId) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup") {
      await handleSetupCommand(interaction as ChatInputCommandInteraction, musicManager);
    }
    return;
  }

  if (interaction.isButton()) {
    await handleButtonInteraction(interaction, musicManager);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalInteraction(interaction, musicManager);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    await handleSelectInteraction(interaction, musicManager);
    return;
  }
};
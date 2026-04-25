import { Interaction, ChatInputCommandInteraction } from "discord.js";
import { MusicManager } from "../music/music-manager";
import { handleSetupCommand } from "../commands/setup";
import { handleDeletePlaylistCommand } from "../commands/delete-playlist";
import {
  handleDeletePlaylistSongAutocomplete,
  handleDeletePlaylistSongCommand,
} from "../commands/delete-playlist-song";
import { handleButtonInteraction } from "./button-handlers";
import { handleModalInteraction } from "./modal-handlers";
import { handleSelectInteraction } from "./select-handlers";

export const handleInteraction = async (
  interaction: Interaction,
  musicManager: MusicManager,
) => {
  if (!interaction.guildId) return;

  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "delete-playlist-song") {
      await handleDeletePlaylistSongAutocomplete(interaction);
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup") {
      await handleSetupCommand(interaction as ChatInputCommandInteraction, musicManager);
    }
    if (interaction.commandName === "delete-playlist") {
      await handleDeletePlaylistCommand(interaction as ChatInputCommandInteraction);
    }
    if (interaction.commandName === "delete-playlist-song") {
      await handleDeletePlaylistSongCommand(interaction as ChatInputCommandInteraction);
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

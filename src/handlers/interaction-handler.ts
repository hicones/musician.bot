import { Interaction, ChatInputCommandInteraction } from "discord.js";
import { MusicManager } from "../music/music-manager";
import { handleSetupCommand } from "../commands/setup";
import {
  handleDeletePlaylistAutocomplete,
  handleDeletePlaylistCommand,
} from "../commands/delete-playlist";
import {
  handleDeletePlaylistSongAutocomplete,
  handleDeletePlaylistSongCommand,
} from "../commands/delete-playlist-song";
import {
  handleAddCurrentToPlaylistAutocomplete,
  handleAddCurrentToPlaylistCommand,
} from "../commands/add-current-to-playlist";
import {
  handleRemoveFavoriteAutocomplete,
  handleRemoveFavoriteCommand,
} from "../commands/remove-favorite";
import {
  handleExportPlaylistAutocomplete,
  handleExportPlaylistCommand,
} from "../commands/export-playlist";
import { handleImportPlaylistCommand } from "../commands/import-playlist";
import { handleButtonInteraction } from "./button-handlers";
import { handleModalInteraction } from "./modal-handlers";
import { handleSelectInteraction } from "./select-handlers";

export const handleInteraction = async (
  interaction: Interaction,
  musicManager: MusicManager,
) => {
  if (!interaction.guildId) return;

  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "delete-playlist") {
      await handleDeletePlaylistAutocomplete(interaction);
    }
    if (interaction.commandName === "delete-playlist-song") {
      await handleDeletePlaylistSongAutocomplete(interaction);
    }
    if (interaction.commandName === "add-current-to-playlist") {
      await handleAddCurrentToPlaylistAutocomplete(interaction);
    }
    if (interaction.commandName === "remove-favorite") {
      await handleRemoveFavoriteAutocomplete(interaction);
    }
    if (interaction.commandName === "export-playlist") {
      await handleExportPlaylistAutocomplete(interaction);
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
    if (interaction.commandName === "add-current-to-playlist") {
      await handleAddCurrentToPlaylistCommand(
        interaction as ChatInputCommandInteraction,
        musicManager,
      );
    }
    if (interaction.commandName === "remove-favorite") {
      await handleRemoveFavoriteCommand(interaction as ChatInputCommandInteraction);
    }
    if (interaction.commandName === "export-playlist") {
      await handleExportPlaylistCommand(interaction as ChatInputCommandInteraction);
    }
    if (interaction.commandName === "import-playlist") {
      await handleImportPlaylistCommand(interaction as ChatInputCommandInteraction);
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

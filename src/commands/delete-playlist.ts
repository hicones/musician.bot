import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getPlaylists } from "../database/db";
import { isAdminUser } from "../utils/auth";

export const deletePlaylistCommandData = new SlashCommandBuilder()
  .setName("delete-playlist")
  .setDescription("Exclui uma playlist salva")
  .addStringOption((option) =>
    option
      .setName("playlist")
      .setDescription("Playlist que sera excluida")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const handleDeletePlaylistCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir playlists.",
      ephemeral: true,
    });
  }

  const playlistId = Number(interaction.options.getString("playlist", true));
  const playlist = getPlaylists(interaction.guildId!).find(
    (item) => item.id === playlistId,
  );

  if (!playlist) {
    return interaction.reply({
      content: "Playlist nao encontrada neste servidor.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`delete_playlist_confirm:${playlist.id}`)
    .setTitle("Confirmar exclusao");

  const confirmationInput = new TextInputBuilder()
    .setCustomId("delete_playlist_confirmation")
    .setLabel('Digite "EXCLUIR" para confirmar')
    .setPlaceholder(playlist.name.slice(0, 100))
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(confirmationInput),
  );

  await interaction.showModal(modal);
};

export const handleDeletePlaylistAutocomplete = async (
  interaction: AutocompleteInteraction,
) => {
  if (!interaction.guildId || !isAdminUser(interaction.user.id)) {
    return interaction.respond([]);
  }

  const focusedValue = normalizeSearchValue(interaction.options.getFocused());
  const options = getPlaylists(interaction.guildId)
    .filter((playlist) =>
      normalizeSearchValue(playlist.name).includes(focusedValue),
    )
    .slice(0, 25)
    .map((playlist) => ({
      name: playlist.name.slice(0, 100),
      value: playlist.id.toString(),
    }));

  return interaction.respond(options);
};

const normalizeSearchValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

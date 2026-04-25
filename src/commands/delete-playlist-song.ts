import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getPlaylistSongsWithIds, getPlaylists } from "../database/db";
import { isAdminUser } from "../utils/auth";

export const deletePlaylistSongCommandData = new SlashCommandBuilder()
  .setName("delete-playlist-song")
  .setDescription("Exclui uma faixa de uma playlist salva")
  .addStringOption((option) =>
    option
      .setName("playlist")
      .setDescription("Playlist de onde a faixa sera removida")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName("faixa")
      .setDescription("Faixa que sera removida")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const handleDeletePlaylistSongCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir faixas de playlists.",
      ephemeral: true,
    });
  }

  const playlistId = Number(interaction.options.getString("playlist", true));
  const songId = Number(interaction.options.getString("faixa", true));
  const playlist = getPlaylists(interaction.guildId!).find(
    (item) => item.id === playlistId,
  );
  const song = getPlaylistSongsWithIds(playlistId).find(
    (item) => item.id === songId,
  );

  if (!playlist || !song) {
    return interaction.reply({
      content: "Playlist ou faixa nao encontrada neste servidor.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`delete_playlist_song_confirm:${playlist.id}:${song.id}`)
    .setTitle("Confirmar exclusao");

  const confirmationInput = new TextInputBuilder()
    .setCustomId("delete_playlist_song_confirmation")
    .setLabel('Digite "EXCLUIR" para confirmar')
    .setPlaceholder(song.title.slice(0, 100))
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(confirmationInput),
  );

  await interaction.showModal(modal);
};

export const handleDeletePlaylistSongAutocomplete = async (
  interaction: AutocompleteInteraction,
) => {
  if (!interaction.guildId || !isAdminUser(interaction.user.id)) {
    return interaction.respond([]);
  }

  const focusedOption = interaction.options.getFocused(true);
  const focusedValue = normalizeSearchValue(focusedOption.value);

  if (focusedOption.name === "playlist") {
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
  }

  if (focusedOption.name === "faixa") {
    const playlistId = Number(interaction.options.getString("playlist"));
    if (!playlistId) {
      return interaction.respond([]);
    }

    const options = getPlaylistSongsWithIds(playlistId)
      .filter((song) => normalizeSearchValue(song.title).includes(focusedValue))
      .slice(0, 25)
      .map((song) => ({
        name: formatSongOptionName(song.title, song.duration),
        value: song.id.toString(),
      }));

    return interaction.respond(options);
  }

  return interaction.respond([]);
};

const normalizeSearchValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const formatSongOptionName = (title: string, duration?: string) => {
  const label = duration ? `${title} - ${duration}` : title;
  return label.slice(0, 100);
};

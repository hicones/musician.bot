import {
  deletePlaylist,
  deletePlaylistSong,
  getPlaylistSongsWithIds,
  getPlaylists,
  savePlaylist,
  type SongData,
} from "../database/db";
import { isAdminUser } from "../utils/auth";

export const handleModalInteraction = async (interaction: any, musicManager: any) => {
  if (interaction.customId.startsWith("delete_playlist_song_confirm:")) {
    return handleDeletePlaylistSongConfirmation(interaction);
  }

  if (interaction.customId.startsWith("delete_playlist_confirm:")) {
    return handleDeletePlaylistConfirmation(interaction);
  }

  if (interaction.customId !== "save_playlist_modal") return;

  const name = interaction.fields.getTextInputValue("playlist_name");
  const queue = musicManager.distube.getQueue(interaction.guildId);

  if (!queue) {
    return interaction.reply({ content: "Erro ao salvar: fila vazia.", ephemeral: true });
  }

  const songs = queue.songs.map((s: any) => ({
    title: s.name || "Sem Título",
    url: s.url,
    duration: s.formattedDuration,
    thumbnail: s.thumbnail,
  }));

  savePlaylist(name, interaction.user.id, interaction.guildId, songs as SongData[]);

  await interaction.reply({ content: `Playlist **${name}** salva com sucesso!`, ephemeral: true });
};

const handleDeletePlaylistConfirmation = async (interaction: any) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir playlists.",
      ephemeral: true,
    });
  }

  const [, playlistIdText] = interaction.customId.split(":");
  const playlistId = Number(playlistIdText);
  const confirmation = interaction.fields
    .getTextInputValue("delete_playlist_confirmation")
    .trim()
    .toUpperCase();

  if (confirmation !== "EXCLUIR") {
    return interaction.reply({
      content: "Exclusao cancelada. A confirmacao precisa ser EXCLUIR.",
      ephemeral: true,
    });
  }

  const playlist = getPlaylists(interaction.guildId).find((item) => item.id === playlistId);
  if (!playlist) {
    return interaction.reply({
      content: "Playlist nao encontrada neste servidor.",
      ephemeral: true,
    });
  }

  const deleted = deletePlaylist(playlistId, interaction.guildId);

  await interaction.reply({
    content: deleted
      ? `Playlist **${playlist.name}** excluida com sucesso.`
      : "Nao foi possivel excluir a playlist selecionada.",
    ephemeral: true,
  });
};

const handleDeletePlaylistSongConfirmation = async (interaction: any) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir faixas de playlists.",
      ephemeral: true,
    });
  }

  const [, playlistIdText, songIdText] = interaction.customId.split(":");
  const playlistId = Number(playlistIdText);
  const songId = Number(songIdText);
  const confirmation = interaction.fields
    .getTextInputValue("delete_playlist_song_confirmation")
    .trim()
    .toUpperCase();

  if (confirmation !== "EXCLUIR") {
    return interaction.reply({
      content: "Exclusao cancelada. A confirmacao precisa ser EXCLUIR.",
      ephemeral: true,
    });
  }

  const playlist = getPlaylists(interaction.guildId).find((item) => item.id === playlistId);
  const song = getPlaylistSongsWithIds(playlistId).find((item) => item.id === songId);

  if (!playlist || !song) {
    return interaction.reply({
      content: "Playlist ou faixa nao encontrada neste servidor.",
      ephemeral: true,
    });
  }

  const deleted = deletePlaylistSong(playlistId, songId, interaction.guildId);

  await interaction.reply({
    content: deleted
      ? `Faixa **${song.title}** excluida da playlist **${playlist.name}**.`
      : "Nao foi possivel excluir a faixa selecionada.",
    ephemeral: true,
  });
};

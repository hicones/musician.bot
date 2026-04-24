import { savePlaylist, type SongData } from "../database/db.js";

export const handleModalInteraction = async (interaction: any, musicManager: any) => {
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
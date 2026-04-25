import { TextChannel } from "discord.js";
import { getPlaylistSongs } from "../database/db";
import { formatError } from "../utils/format-error";
import { shuffleSongs } from "../utils/queue";

export const handleSelectInteraction = async (interaction: any, musicManager: any) => {
  if (interaction.customId !== "select_playlist") return;

  const playlistId = parseInt(interaction.values[0]);
  const songs = shuffleSongs(getPlaylistSongs(playlistId));
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({ content: "Você precisa estar em um canal de voz!", ephemeral: true });
  }

  await interaction.deferUpdate();

  const { guildId } = interaction;
  const queue = musicManager.distube.getQueue(guildId);
  if (queue) {
    musicManager.stopAndClearQueue(guildId);
  }

  let loadedSongs = 0;
  for (const songData of songs) {
    try {
      await musicManager.distube.play(voiceChannel, songData.url, {
        member: interaction.member,
        textChannel: interaction.channel as TextChannel,
      });
      loadedSongs++;
    } catch (error) {
      console.error(`[Playlist] Erro ao carregar "${songData.title}" da playlist selecionada:`);
      console.error(formatError(error));
    }
  }

  await interaction.followUp({
    content:
      loadedSongs > 0
        ? `Tocando playlist selecionada! ${loadedSongs}/${songs.length} faixa(s) carregada(s).`
        : "Nao consegui carregar nenhuma faixa da playlist selecionada.",
    ephemeral: true,
  });

  if (interaction.channel) {
    musicManager.updatePlayerMessage(interaction.channel as TextChannel);
  }
};

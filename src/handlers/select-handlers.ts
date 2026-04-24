import { TextChannel } from "discord.js";
import { getPlaylistSongs } from "../database/db.js";
import { shuffleSongs } from "../utils/queue.js";

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

  for (const songData of songs) {
    await musicManager.distube.play(voiceChannel, songData.url, {
      member: interaction.member,
      textChannel: interaction.channel as TextChannel,
    });
  }

  await interaction.followUp({ content: "Tocando playlist selecionada!", ephemeral: true });

  if (interaction.channel) {
    musicManager.updatePlayerMessage(interaction.channel as TextChannel);
  }
};
import {
  ActionRowBuilder,
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { getPlaylistSongs, getPlaylists } from "../database/db";
import { isAdminUser } from "../utils/auth";
import { shuffleSongs } from "../utils/queue";

export const handleSelectInteraction = async (interaction: any, musicManager: any) => {
  if (interaction.customId === "delete_playlist_select") {
    return handleDeletePlaylistSelect(interaction);
  }

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

const handleDeletePlaylistSelect = async (interaction: any) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir playlists.",
      ephemeral: true,
    });
  }

  const playlistId = Number(interaction.values[0]);
  const playlist = getPlaylists(interaction.guildId).find((item) => item.id === playlistId);

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

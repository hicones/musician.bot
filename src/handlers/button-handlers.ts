import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { MusicManager } from "../music/music-manager";
import { createPlayerEmbed, getQueuePageInfo, getPlayerButtons } from "../utils/player-embed";
import { getPlaylists } from "../database/db";
import { getFavoriteSongs } from "../database/db";
import { shuffleSongs } from "../utils/queue";

export const handleButtonInteraction = async (
  interaction: any,
  musicManager: MusicManager,
) => {
  const { customId, guildId, member } = interaction;
  const queue = musicManager.distube.getQueue(guildId);

  if (customId === "view_queue" || customId.startsWith("view_queue:")) {
    return handleViewQueue(interaction, musicManager, queue);
  }

  if (customId === "back_to_player") {
    return handleBackToPlayer(interaction, musicManager, queue);
  }

  if (customId === "save_playlist_btn") {
    return handleSavePlaylistBtn(interaction, queue);
  }

  if (customId === "play_playlist") {
    return handlePlayPlaylist(interaction);
  }

  if (customId === "start_radio") {
    return handleStartRadio(interaction, musicManager);
  }
};

const handleViewQueue = async (interaction: any, musicManager: MusicManager, queue: any) => {
  const { customId, guildId } = interaction;
  const history = musicManager.getHistory(guildId);

  const requestedPage = getRequestedQueuePage(customId);
  const pageInfo = getQueuePageInfo(queue, history, requestedPage);
  const embed = createPlayerEmbed(queue, history, true, pageInfo.page);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("back_to_player").setLabel("Voltar").setStyle(ButtonStyle.Primary),
  );

  if (pageInfo.totalPages > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`view_queue:${Math.max(pageInfo.page - 1, 0)}`)
        .setLabel("Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageInfo.page === 0),
      new ButtonBuilder()
        .setCustomId(`view_queue:${Math.min(pageInfo.page + 1, pageInfo.totalPages - 1)}`)
        .setLabel("Próxima")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageInfo.page >= pageInfo.totalPages - 1),
    );
  }

  row.addComponents(new ButtonBuilder().setCustomId("save_playlist_btn").setLabel("Salvar Playlist").setStyle(ButtonStyle.Success));

  await interaction.update({ embeds: [embed], components: [row] });
};

const handleBackToPlayer = async (interaction: any, musicManager: MusicManager, queue: any) => {
  const { guildId } = interaction;
  const history = musicManager.getHistory(guildId);
  const embed = createPlayerEmbed(queue, history, false);
  const components = getPlayerButtons();

  await interaction.update({ embeds: [embed], components });
};

const handleSavePlaylistBtn = async (interaction: any, queue: any) => {
  if (!queue || !queue.songs.length) {
    return interaction.reply({ content: "Não há músicas na fila para salvar!", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("save_playlist_modal")
    .setTitle("Salvar Playlist");

  const nameInput = new TextInputBuilder()
    .setCustomId("playlist_name")
    .setLabel("Nome da Playlist")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: Minhas Favoritas")
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
  await interaction.showModal(modal);
};

const handlePlayPlaylist = async (interaction: any) => {
  const { guildId } = interaction;
  const playlists = getPlaylists(guildId);

  if (playlists.length === 0) {
    return interaction.reply({ content: "Você não tem playlists salvas!", ephemeral: true });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("select_playlist")
    .setPlaceholder("Escolha uma playlist...")
    .addOptions(playlists.map((p: any) => ({ label: p.name, value: p.id.toString() })));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({ content: "Selecione uma playlist para tocar:", components: [row], ephemeral: true });
};

const handleStartRadio = async (interaction: any, musicManager: MusicManager) => {
  const { guildId, member, channel } = interaction;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({ content: "Você precisa estar em um canal de voz para iniciar o rádio!", ephemeral: true });
  }

  const favoriteSongs = shuffleSongs(getFavoriteSongs(guildId));

  if (favoriteSongs.length === 0) {
    return interaction.reply({ content: "Ainda não há músicas favoritadas para iniciar o rádio.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const queue = musicManager.distube.getQueue(guildId);
  musicManager.disableRadioMode(guildId);
  if (queue) {
    musicManager.stopAndClearQueue(guildId);
  }

  let loadedSongs = 0;
  for (const songData of favoriteSongs) {
    try {
      await musicManager.distube.play(voiceChannel, songData.url, {
        member,
        textChannel: channel,
      });
      loadedSongs++;
    } catch (error) {
      console.error(`[Radio] Erro ao carregar favorito "${songData.title}":`, error);
    }
  }

  const radioQueue = musicManager.distube.getQueue(guildId);
  radioQueue?.setRepeatMode(2);
  if (loadedSongs > 0) {
    musicManager.enableRadioMode(guildId);
  }

  await interaction.editReply({
    content: loadedSongs > 0 ? `Rádio iniciada com ${loadedSongs} música(s) favoritadas em modo aleatório e loop.` : "Não consegui carregar nenhuma música favorita para iniciar o rádio.",
  });

  if (channel?.isTextBased()) {
    musicManager.updatePlayerMessage(channel);
  }
};

const getRequestedQueuePage = (customId: string) => {
  const [, page] = customId.split(":");
  return page ? Number(page) : 0;
};

import { 
  Interaction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  TextChannel,
  EmbedBuilder
} from 'discord.js';
import { MusicManager } from '../music/MusicManager';
import { createPlayerEmbed } from '../utils/playerEmbed';
import { savePlaylist, getPlaylists, getPlaylistSongs, SongData } from '../database/db';

export const handleInteraction = async (interaction: Interaction, musicManager: MusicManager) => {
  if (!interaction.guildId) return;

  if (interaction.isButton()) {
    const queue = musicManager.distube.getQueue(interaction.guildId);

    if (interaction.customId === 'view_queue') {
      const history = musicManager.getHistory(interaction.guildId);
      const embed = createPlayerEmbed(queue, history, true);
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_player')
          .setLabel('Voltar ao Player')
          .setEmoji('🔙')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('save_playlist_btn')
          .setLabel('Salvar Playlist')
          .setEmoji('💾')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }

    else if (interaction.customId === 'back_to_player') {
      const history = musicManager.getHistory(interaction.guildId);
      const embed = createPlayerEmbed(queue, history, false);
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('view_queue').setLabel('Ver Fila').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('play_playlist').setLabel('Tocar Playlist').setStyle(ButtonStyle.Primary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }

    else if (interaction.customId === 'save_playlist_btn') {
      if (!queue || !queue.songs.length) {
        return interaction.reply({ content: 'Não há músicas na fila para salvar!', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('save_playlist_modal')
        .setTitle('Salvar Playlist');

      const nameInput = new TextInputBuilder()
        .setCustomId('playlist_name')
        .setLabel('Nome da Playlist')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Minhas Favoritas')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
      await interaction.showModal(modal);
    }

    else if (interaction.customId === 'play_playlist') {
      const playlists = getPlaylists(interaction.guildId);
      
      if (playlists.length === 0) {
        return interaction.reply({ content: 'Você não tem playlists salvas!', ephemeral: true });
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_playlist')
        .setPlaceholder('Escolha uma playlist...')
        .addOptions(playlists.map(p => ({
          label: p.name,
          value: p.id.toString(),
          emoji: '🎵'
        })));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      
      await interaction.reply({ content: 'Selecione uma playlist para tocar:', components: [row], ephemeral: true });
    }
  }

  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'save_playlist_modal') {
      const name = interaction.fields.getTextInputValue('playlist_name');
      const queue = musicManager.distube.getQueue(interaction.guildId);
      
      if (!queue) return interaction.reply({ content: 'Erro ao salvar: fila vazia.', ephemeral: true });

      const songs = queue.songs.map(s => ({
        title: s.name || 'Sem Título',
        url: s.url,
        duration: s.formattedDuration,
        thumbnail: s.thumbnail
      }));

      savePlaylist(name, interaction.user.id, interaction.guildId!, songs as SongData[]);
      await interaction.reply({ content: `Playlist **${name}** salva com sucesso!`, ephemeral: true });
    }
  }

  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_playlist') {
      const playlistId = parseInt(interaction.values[0]);
      const songs = getPlaylistSongs(playlistId);
      const voiceChannel = (interaction.member as any).voice?.channel;

      if (!voiceChannel) {
        return interaction.reply({ content: 'Você precisa estar em um canal de voz!', ephemeral: true });
      }

      await interaction.deferUpdate();

      // Clear existing queue
      const queue = musicManager.distube.getQueue(interaction.guildId);
      if (queue) {
        queue.stop();
        musicManager.clearHistory(interaction.guildId);
      }

      // Play each song
      for (const songData of songs) {
        await musicManager.distube.play(voiceChannel, songData.url, {
          member: interaction.member as any,
          textChannel: interaction.channel as TextChannel
        });
      }

      await interaction.followUp({ content: `Tocando playlist selecionada!`, ephemeral: true });
      musicManager.updatePlayerMessage(interaction.channel as TextChannel);
    }
  }
};

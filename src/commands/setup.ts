import { Message, TextChannel, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { createPlayerEmbed, getPlayerAttachments } from '../utils/playerEmbed';
import { MusicManager } from '../music/MusicManager';

export const setupCommand = async (message: Message, musicManager: MusicManager) => {
  if (!message.guild || !message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('Você precisa de permissões de administrador para usar este comando.');
  }

  const guild = message.guild;
  
  // Check if channel already exists
  let channel = guild.channels.cache.find(c => c.name === 'music-room' && c.type === ChannelType.GuildText) as TextChannel;
  
  if (!channel) {
    channel = await guild.channels.create({
      name: 'music-room',
      type: ChannelType.GuildText,
      topic: 'Controle de Música do Bot',
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        }
      ]
    });
  } else {
    // Clear channel messages
    const fetched = await channel.messages.fetch({ limit: 100 });
    await channel.bulkDelete(fetched);
  }

  const attachments = getPlayerAttachments();
  const embed = createPlayerEmbed(undefined, []);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('view_queue')
        .setLabel('Ver Fila')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('play_playlist')
        .setLabel('Tocar Playlist')
        .setEmoji('🎵')
        .setStyle(ButtonStyle.Primary),
    );

  // Send Banner first
  await channel.send({ files: [attachments[0]] });

  // Send Embed with buttons
  const controllerMsg = await channel.send({
    embeds: [embed],
    files: [attachments[1]], // Placeholder for the embed
    components: [row]
  });

  // Add reactions for controls
  const emojis = ['⏯️', '⏮️', '⏭️', '🔀', '🔁', '🚪'];
  for (const emoji of emojis) {
    await controllerMsg.react(emoji);
  }

  await message.reply(`Canal ${channel} configurado com sucesso!`);
};

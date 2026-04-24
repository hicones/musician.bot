import { Client, GatewayIntentBits, Partials, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { MusicManager } from './music/MusicManager';
import { setupCommand } from './commands/setup';
import { handleReaction } from './handlers/reactionHandler';
import { handleInteraction } from './handlers/interactionHandler';
import { formatError } from './utils/formatError';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const musicManager = new MusicManager(client);

const getMusicRequestType = (input: string) => {
  if (/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(input)) {
    return input.includes('list=') || /\/playlist(?:\?|\/)/i.test(input) ? 'Playlist YouTube' : 'URL YouTube';
  }

  if (/^https?:\/\/open\.spotify\.com\/playlist\//i.test(input)) return 'Playlist Spotify';
  if (/^https?:\/\/open\.spotify\.com\//i.test(input)) return 'URL Spotify';
  if (/^https?:\/\/(?:www\.)?soundcloud\.com\//i.test(input)) return 'URL SoundCloud';
  if (/^https?:\/\//i.test(input)) return 'URL';

  return 'Busca YouTube';
};

client.once('clientReady', () => {
  console.log(`Bot logado como ${client.user?.tag}`);
  console.log(`Prefixo configurado: ${process.env.PREFIX || '!'}`);
});

if (!process.env.DISCORD_TOKEN) {
  console.error('ERRO: DISCORD_TOKEN nao encontrado no ambiente!');
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = process.env.PREFIX || '!';

  // Command setup
  if (message.content.startsWith(`${prefix}setup`)) {
    console.log(`[Command] Setup iniciado por ${message.author.tag} no servidor ${message.guild.name}`);
    await setupCommand(message, musicManager);
    return;
  }

  // Handle music play via URL or search query in music-room
  const channel = message.channel as TextChannel;
  if (channel.name === 'music-room') {
    const requestedSong = message.content.trim();
    if (!requestedSong || requestedSong.startsWith(prefix)) return;

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      // Don't reply here to keep channel clean, maybe delete message
      return;
    }

    const requestType = getMusicRequestType(requestedSong);
    console.log(`[Music] ${requestType} detectada: ${requestedSong} (Usuario: ${message.author.tag})`);

    try {
      await musicManager.distube.play(voiceChannel, requestedSong, {
        member: message.member,
        textChannel: channel,
        message,
      });
      // Delete original message to keep channel clean
      await message.delete().catch(() => {});
    } catch (e) {
      console.error(`[Music Error] Erro ao tentar tocar ${requestType}:`);
      console.error(formatError(e));
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  await handleReaction(reaction as any, user as any, musicManager);
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction, musicManager);
});

client.login(process.env.DISCORD_TOKEN);

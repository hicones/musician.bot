import {
  Client,
  GatewayIntentBits,
  Partials,
  TextChannel,
  REST,
  Routes,
  VoiceState,
} from "discord.js";
import dotenv from "dotenv";
import { MusicManager } from "./music/music-manager";
import { setupCommandData } from "./commands/setup";
import { handleReaction } from "./handlers/reaction-handler";
import { handleInteraction } from "./handlers/interaction-handler";
import { formatError } from "./utils/format-error";

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
const emptyVoiceTimeouts = new Map<string, NodeJS.Timeout>();

const getMusicRequestType = (input: string) => {
  if (
    /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(
      input,
    )
  ) {
    return input.includes("list=") || /\/playlist(?:\?|\/)/i.test(input)
      ? "Playlist YouTube"
      : "URL YouTube";
  }

  if (/^https?:\/\/open\.spotify\.com\/playlist\//i.test(input))
    return "Playlist Spotify";
  if (/^https?:\/\/open\.spotify\.com\//i.test(input)) return "URL Spotify";
  if (/^https?:\/\/(?:www\.)?soundcloud\.com\//i.test(input))
    return "URL SoundCloud";
  if (/^https?:\/\//i.test(input)) return "URL";

  return "Busca YouTube";
};

client.once("ready", async () => {
  console.log(`Bot logado como ${client.user?.tag}`);

  // Registrar slash commands
  try {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN!,
    );
    const commands = [setupCommandData.toJSON()];

    console.log(`Registrando ${commands.length} slash command(s)...`);

    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands,
    });

    console.log("✅ Slash commands registrados com sucesso");
  } catch (error) {
    console.error("❌ Erro ao registrar slash commands:", error);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("ERRO: DISCORD_TOKEN nao encontrado no ambiente!");
}

if (!process.env.ADMIN_USER_IDS) {
  console.warn(
    "AVISO: ADMIN_USER_IDS nao configurado. Nenhum user poderá usar /setup",
  );
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = process.env.PREFIX || "!";

  // Handle music play via URL or search query in music-room
  const channel = message.channel as TextChannel;
  if (channel.name === "music-room") {
    const requestedSong = message.content.trim();
    if (!requestedSong || requestedSong.startsWith(prefix)) return;

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      // Don't reply here to keep channel clean, maybe delete message
      return;
    }

    const requestType = getMusicRequestType(requestedSong);
    console.log(
      `[Music] ${requestType} detectada: ${requestedSong} (Usuario: ${message.author.tag})`,
    );

    try {
      const guildId = message.guild.id;
      const wasRadioModeActive = musicManager.isRadioModeActive(guildId);
      const radioQueue = wasRadioModeActive
        ? musicManager.distube.getQueue(guildId)
        : undefined;

      if (wasRadioModeActive) {
        musicManager.disableRadioMode(guildId);
        musicManager.clearHistory(guildId);

        if (radioQueue) {
          radioQueue.setRepeatMode(0);
          radioQueue.songs.splice(1);
        }
      }

      await musicManager.distube.play(voiceChannel, requestedSong, {
        member: message.member,
        textChannel: channel,
        message,
      });

      if (radioQueue) {
        await radioQueue.skip();
        console.log(
          `[Radio] Modo radio encerrado; fila substituida pelo novo pedido de ${message.author.tag}`,
        );
      }

      // Delete original message to keep channel clean
      await message.delete().catch(() => {});
    } catch (e) {
      console.error(`[Music Error] Erro ao tentar tocar ${requestType}:`);
      console.error(formatError(e));
    }
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  await handleReaction(reaction as any, user as any, musicManager);
});

client.on("interactionCreate", async (interaction) => {
  await handleInteraction(interaction, musicManager);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  await handleEmptyVoiceChannel(oldState, newState);
});

client.login(process.env.DISCORD_TOKEN);

const handleEmptyVoiceChannel = async (
  oldState: VoiceState,
  newState: VoiceState,
) => {
  const guildId = newState.guild.id;
  const queue = musicManager.distube.getQueue(guildId);
  if (!queue?.voiceChannel) {
    clearEmptyVoiceTimeout(guildId);
    return;
  }

  const affectedChannelId = oldState.channelId || newState.channelId;
  if (!affectedChannelId || affectedChannelId !== queue.voiceChannel.id) {
    return;
  }

  const voiceChannel = queue.voiceChannel;
  const humanMembers = voiceChannel.members.filter((member) => !member.user.bot);
  if (humanMembers.size > 0) {
    clearEmptyVoiceTimeout(guildId);
    return;
  }

  if (emptyVoiceTimeouts.has(guildId)) {
    return;
  }

  const timeoutMs = musicManager.activityManager.getInactivityTimeoutMs();
  const timeout = setTimeout(() => {
    void disconnectIfVoiceChannelStillEmpty(guildId);
  }, timeoutMs);

  emptyVoiceTimeouts.set(guildId, timeout);
  console.log(
    `[Voice] Call vazia em "${voiceChannel.name}" de "${voiceChannel.guild.name}". Desconexao agendada para ${Math.round(timeoutMs / 1000)}s.`,
  );
};

const disconnectIfVoiceChannelStillEmpty = async (guildId: string) => {
  clearEmptyVoiceTimeout(guildId);

  const queue = musicManager.distube.getQueue(guildId);
  const voiceChannel = queue?.voiceChannel;
  if (!queue || !voiceChannel) {
    return;
  }

  const humanMembers = voiceChannel.members.filter((member) => !member.user.bot);
  if (humanMembers.size > 0) {
    return;
  }

  musicManager.disableRadioMode(guildId);
  musicManager.clearHistory(guildId);
  musicManager.activityManager.clearActivity(guildId);

  try {
    queue.voice.leave();
    console.log(
      `[Voice] Bot saiu de "${voiceChannel.name}" em "${voiceChannel.guild.name}" por nao haver usuarios na call apos o timeout de inatividade`,
    );
  } catch (error) {
    console.warn(
      `[Voice] Erro ao sair da call vazia em ${voiceChannel.guild.name}: ${(error as Error).message}`,
    );
  }
};

const clearEmptyVoiceTimeout = (guildId: string) => {
  const timeout = emptyVoiceTimeouts.get(guildId);
  if (!timeout) {
    return;
  }

  clearTimeout(timeout);
  emptyVoiceTimeouts.delete(guildId);
};

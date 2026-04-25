import { TextChannel } from "discord.js";
import { MusicManager } from "../music/music-manager";
import { saveGuildConfig } from "../database/db";
import { getPlayerAttachments, createPlayerEmbed, getPlayerButtons } from "../utils/player-embed";
import type { SetupStep, SetupResult } from "../models/setup.model";

const PLAYER_EMOJIS = [
  "\u23EE\uFE0F",
  "\u25B6\uFE0F",
  "\u23ED\uFE0F",
  "\u23F9\uFE0F",
  "\u{1F500}",
  "\u{1F501}",
  "\u{1F31F}",
  "\u{1F6AA}",
];

export const performSetup = async (
  guildId: string,
  userId: string,
  channel: TextChannel,
  musicManager: MusicManager,
): Promise<SetupResult> => {
  const steps: SetupStep[] = [];

  try {
    const step1 = await stepCleanupChannel(channel);
    steps.push(step1);

    const step2 = await stepSendHeaderImage(channel);
    steps.push(step2);

    const step3Result = await stepSendPlayerMessage(channel);
    steps.push(step3Result.step);
    if (!step3Result.playerMessageId) {
      throw new Error("Falha ao criar mensagem do player");
    }

    const step4 = await stepAddReactions(channel, step3Result.playerMessageId);
    steps.push(step4);

    const step5 = await stepSaveConfig(guildId, userId, channel.id, step3Result.playerMessageId);
    steps.push(step5);

    const allSuccess = steps.every((s) => s.success);
    return {
      success: allSuccess,
      steps,
      channelId: channel.id,
      messageId: step3Result.playerMessageId,
    };
  } catch (error) {
    console.error("[Setup Error]", error);
    return {
      success: false,
      steps,
    };
  }
};

const stepCleanupChannel = async (channel: TextChannel): Promise<SetupStep> => {
  const start = Date.now();
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const botMessages = messages.filter((m) => m.author.id === channel.client.user?.id);

    if (botMessages.size > 0) {
      await channel.bulkDelete(botMessages);
    }

    return { name: "Limpar mensagens antigas", success: true, duration: Date.now() - start };
  } catch (error) {
    return { name: "Limpar mensagens antigas", success: false, error: (error as Error).message, duration: Date.now() - start };
  }
};

const stepSendHeaderImage = async (channel: TextChannel): Promise<SetupStep> => {
  const start = Date.now();
  try {
    const attachments = getPlayerAttachments();
    await channel.send({ files: [attachments[0]] });
    return { name: "Enviar cabeçalho visual", success: true, duration: Date.now() - start };
  } catch (error) {
    return { name: "Enviar cabeçalho visual", success: false, error: (error as Error).message, duration: Date.now() - start };
  }
};

const stepSendPlayerMessage = async (channel: TextChannel): Promise<{ step: SetupStep; playerMessageId: string }> => {
  const start = Date.now();
  try {
    const attachments = getPlayerAttachments();
    const embed = createPlayerEmbed(undefined, []);
    const components = getPlayerButtons();

    const msg = await channel.send({
      embeds: [embed],
      files: [attachments[1]],
      components,
    });

    return {
      step: { name: "Enviar embed do player", success: true, duration: Date.now() - start },
      playerMessageId: msg.id,
    };
  } catch (error) {
    return {
      step: { name: "Enviar embed do player", success: false, error: (error as Error).message, duration: Date.now() - start },
      playerMessageId: "",
    };
  }
};

const stepAddReactions = async (channel: TextChannel, messageId: string): Promise<SetupStep> => {
  const start = Date.now();
  let reactionsAdded = 0;

  try {
    const playerMsg = await channel.messages.fetch(messageId);

    for (const emoji of PLAYER_EMOJIS) {
      try {
        await playerMsg.react(emoji);
        reactionsAdded++;
      } catch {
        continue;
      }
    }

    return {
      name: `Adicionar reações (${reactionsAdded}/${PLAYER_EMOJIS.length})`,
      success: reactionsAdded === PLAYER_EMOJIS.length,
      error: reactionsAdded < PLAYER_EMOJIS.length ? "Algumas reações falharam" : undefined,
      duration: Date.now() - start,
    };
  } catch (error) {
    return { name: "Adicionar reações", success: false, error: (error as Error).message, duration: Date.now() - start };
  }
};

const stepSaveConfig = async (
  guildId: string,
  userId: string,
  channelId: string,
  playerMessageId: string,
): Promise<SetupStep> => {
  const start = Date.now();
  try {
    saveGuildConfig(guildId, {
      guild_id: guildId,
      music_room_id: channelId,
      player_message_id: playerMessageId,
      setup_by: userId,
      status: "active",
    });

    return { name: "Salvar configuração no banco de dados", success: true, duration: Date.now() - start };
  } catch (error) {
    return { name: "Salvar configuração no banco de dados", success: false, error: (error as Error).message, duration: Date.now() - start };
  }
};
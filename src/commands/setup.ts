import {
  ChatInputCommandInteraction,
  TextChannel,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { createPlayerEmbed, getPlayerAttachments } from "../utils/playerEmbed";
import { MusicManager } from "../music/MusicManager";
import {
  getGuildConfig,
  saveGuildConfig,
  updatePlayerMessageId,
} from "../database/db";

export const setupCommandData = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configura o bot de música no servidor");

interface SetupStep {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

interface SetupResult {
  success: boolean;
  steps: SetupStep[];
  channelId?: string;
  messageId?: string;
}

const isAdminUser = (userId: string): boolean => {
  const adminIds = process.env.ADMIN_USER_IDS?.split(",") || [];
  return adminIds.includes(userId);
};

const createStepEmbed = (
  title: string,
  steps: SetupStep[],
  isCompleted: boolean,
) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(isCompleted ? 0x00ff00 : 0xffa500)
    .setDescription(
      steps
        .map(
          (step) =>
            `${step.success ? "✅" : "❌"} **${step.name}**${
              step.error ? ` - ${step.error}` : ""
            }${step.duration ? ` (${step.duration}ms)` : ""}`,
        )
        .join("\n"),
    )
    .setTimestamp();

  return embed;
};

const performSetup = async (
  guildId: string,
  userId: string,
  channel: TextChannel,
  musicManager: MusicManager,
): Promise<SetupResult> => {
  const steps: SetupStep[] = [];
  const startTime = Date.now();

  try {
    // Step 1: Limpar mensagens antigas do bot
    const cleanupStart = Date.now();
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const botMessages = messages.filter(
        (m) => m.author.id === channel.client.user?.id,
      );

      if (botMessages.size > 0) {
        await channel.bulkDelete(botMessages);
      }

      steps.push({
        name: "Limpar mensagens antigas",
        success: true,
        duration: Date.now() - cleanupStart,
      });
    } catch (error) {
      steps.push({
        name: "Limpar mensagens antigas",
        success: false,
        error: (error as Error).message,
        duration: Date.now() - cleanupStart,
      });
    }

    // Step 2: Enviar imagem de cabeçalho
    const imageStart = Date.now();
    try {
      const attachments = getPlayerAttachments();
      await channel.send({ files: [attachments[0]] });

      steps.push({
        name: "Enviar cabeçalho visual",
        success: true,
        duration: Date.now() - imageStart,
      });
    } catch (error) {
      steps.push({
        name: "Enviar cabeçalho visual",
        success: false,
        error: (error as Error).message,
        duration: Date.now() - imageStart,
      });
    }

    // Step 3: Enviar embed do player
    const embedStart = Date.now();
    let playerMessageId = "";
    try {
      const attachments = getPlayerAttachments();
      const embed = createPlayerEmbed(undefined, []);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("view_queue")
          .setLabel("Ver Fila")
          .setEmoji("📋")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("play_playlist")
          .setLabel("Tocar Playlist")
          .setEmoji("🎵")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("start_radio")
          .setLabel("Rádio")
          .setEmoji("📻")
          .setStyle(ButtonStyle.Success),
      );

      const msg = await channel.send({
        embeds: [embed],
        files: [attachments[1]],
        components: [row],
      });

      playerMessageId = msg.id;

      steps.push({
        name: "Enviar embed do player",
        success: true,
        duration: Date.now() - embedStart,
      });
    } catch (error) {
      steps.push({
        name: "Enviar embed do player",
        success: false,
        error: (error as Error).message,
        duration: Date.now() - embedStart,
      });
      throw error; // Se falhar aqui, parar o setup
    }

    // Step 4: Adicionar reações
    const reactionsStart = Date.now();
    const emojis = ["⏮️", "▶️", "⏭️", "⏹️", "🔀", "🔁", "🚪"];
    let reactionsAdded = 0;

    try {
      const playerMsg = await channel.messages.fetch(playerMessageId);

      for (const emoji of emojis) {
        try {
          await playerMsg.react(emoji);
          reactionsAdded++;
        } catch {
          // Continuar com próxima reação se uma falhar
          continue;
        }
      }

      steps.push({
        name: `Adicionar reações (${reactionsAdded}/${emojis.length})`,
        success: reactionsAdded === emojis.length,
        error:
          reactionsAdded < emojis.length
            ? "Algumas reações falharam"
            : undefined,
        duration: Date.now() - reactionsStart,
      });
    } catch (error) {
      steps.push({
        name: "Adicionar reações",
        success: false,
        error: (error as Error).message,
        duration: Date.now() - reactionsStart,
      });
    }

    // Step 5: Salvar configuração no banco de dados
    const dbStart = Date.now();
    try {
      saveGuildConfig(guildId, {
        guild_id: guildId,
        music_room_id: channel.id,
        player_message_id: playerMessageId,
        setup_by: userId,
        status: "active",
      });

      steps.push({
        name: "Salvar configuração no banco de dados",
        success: true,
        duration: Date.now() - dbStart,
      });
    } catch (error) {
      steps.push({
        name: "Salvar configuração no banco de dados",
        success: false,
        error: (error as Error).message,
        duration: Date.now() - dbStart,
      });
    }

    const allSuccess = steps.every((s) => s.success);
    return {
      success: allSuccess,
      steps,
      channelId: channel.id,
      messageId: playerMessageId,
    };
  } catch (error) {
    console.error("[Setup Error]", error);
    return {
      success: false,
      steps,
    };
  }
};

export const handleSetupCommand = async (
  interaction: ChatInputCommandInteraction,
  musicManager: MusicManager,
) => {
  // Validar se é admin pelo ID
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content:
        "❌ Você não tem permissão para usar este comando. Apenas admins configurados podem executar o setup.",
      ephemeral: true,
    });
  }

  // Validar se é em um servidor
  if (!interaction.guild || !interaction.guildId) {
    return interaction.reply({
      content: "❌ Este comando só pode ser usado em um servidor.",
      ephemeral: true,
    });
  }

  // Validar permissões do bot
  const botPermissions = interaction.guild.members.me?.permissions;
  if (
    !botPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    !botPermissions?.has(PermissionFlagsBits.SendMessages) ||
    !botPermissions?.has(PermissionFlagsBits.AddReactions)
  ) {
    return interaction.reply({
      content:
        "❌ O bot não tem permissões suficientes. Preciso de: Gerenciar Canais, Enviar Mensagens, e Adicionar Reações.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    let musicChannel = guild.channels.cache.find(
      (c) => c.name === "music-room" && c.type === ChannelType.GuildText,
    ) as TextChannel;

    // Se o canal já existe, oferecer opções
    if (musicChannel) {
      const existingConfig = getGuildConfig(interaction.guildId);

      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_confirm_yes")
          .setLabel("Sim, reconfigurar")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("✅"),
        new ButtonBuilder()
          .setCustomId("setup_confirm_no")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("❌"),
      );

      const confirmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Canal music-room já existe")
        .setDescription(
          existingConfig
            ? `Este servidor já foi configurado em **${new Date(existingConfig.setup_at).toLocaleDateString("pt-BR")}** por <@${existingConfig.setup_by}>.\n\nDeseja reconfigurá-lo? Isso limpará as mensagens antigas e criará um novo player.`
            : "Este servidor já possui um canal music-room. Deseja reconfigurá-lo?",
        )
        .setColor(0xffa500)
        .setTimestamp();

      const message = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });

      // Aguardar resposta por 30 segundos
      const collector = message.createMessageComponentCollector({
        time: 30000,
      });

      let confirmed = false;

      collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return buttonInteraction.reply({
            content: "Você não pode usar este botão.",
            ephemeral: true,
          });
        }

        if (buttonInteraction.customId === "setup_confirm_yes") {
          confirmed = true;
          await buttonInteraction.deferUpdate();
          collector.stop();
        } else if (buttonInteraction.customId === "setup_confirm_no") {
          await buttonInteraction.deferUpdate();
          collector.stop();
        }
      });

      collector.on("end", async () => {
        if (!confirmed) {
          return interaction.editReply({
            content: "❌ Setup cancelado.",
            embeds: [],
            components: [],
          });
        }

        // Executar setup
        const setupEmbed = new EmbedBuilder()
          .setTitle("🔧 Configurando...")
          .setDescription("Aguarde enquanto configuramos o bot de música.")
          .setColor(0x0099ff)
          .setTimestamp();

        await interaction.editReply({
          embeds: [setupEmbed],
          components: [],
        });

        // Interromper player, desconectar da call e limpar fila antes de reconfigurar
        const queue = musicManager.distube.getQueue(interaction.guildId!);
        if (queue) {
          try {
            queue.stop();
            console.log(
              `[Setup] Fila interrompida no servidor ${interaction.guild?.name}`,
            );
          } catch (error) {
            console.warn(
              `[Setup] Erro ao interromper fila: ${(error as Error).message}`,
            );
          }

          try {
            // Desconectar do canal de voz
            if ((queue as any).voice?.leave) {
              (queue as any).voice.leave();
            } else if ((queue as any).leave) {
              (queue as any).leave();
            }
            console.log(
              `[Setup] Desconectado do canal de voz no servidor ${interaction.guild?.name}`,
            );
          } catch (error) {
            console.warn(
              `[Setup] Erro ao desconectar do canal de voz: ${(error as Error).message}`,
            );
          }
        }

        // Limpar histórico de reprodução
        musicManager.clearHistory(interaction.guildId!);

        const result = await performSetup(
          interaction.guildId!,
          interaction.user.id,
          musicChannel,
          musicManager,
        );

        const resultEmbed = createStepEmbed(
          result.success
            ? "✅ Setup concluído com sucesso!"
            : "⚠️ Setup concluído com avisos",
          result.steps,
          result.success,
        );

        await interaction.editReply({
          embeds: [resultEmbed],
          components: [],
        });
      });

      return;
    }

    // Se não existe, criar novo canal
    const creationStart = Date.now();
    try {
      musicChannel = await guild.channels.create({
        name: "music-room",
        type: ChannelType.GuildText,
        topic: "Controle de Música do Bot - Envie links ou nomes de músicas",
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    } catch (error) {
      return interaction.editReply({
        content: `❌ Erro ao criar canal: ${(error as Error).message}`,
      });
    }

    // Mostrar progresso
    const progressEmbed = new EmbedBuilder()
      .setTitle("🔧 Configurando...")
      .setDescription("Criando canal e configurando player...")
      .setColor(0x0099ff)
      .setTimestamp();

    await interaction.editReply({
      embeds: [progressEmbed],
    });

    // Executar setup
    const result = await performSetup(
      interaction.guildId,
      interaction.user.id,
      musicChannel,
      musicManager,
    );

    const resultEmbed = createStepEmbed(
      result.success
        ? "✅ Setup concluído com sucesso!"
        : "⚠️ Setup concluído com avisos",
      result.steps,
      result.success,
    );

    const successRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setURL(
          `https://discord.com/channels/${interaction.guildId}/${result.channelId || ""}`,
        )
        .setLabel("Ir para o canal")
        .setStyle(ButtonStyle.Link)
        .setDisabled(!result.channelId),
    );

    await interaction.editReply({
      embeds: [resultEmbed],
      components: [successRow],
    });
  } catch (error) {
    console.error("[Setup Command Error]", error);
    await interaction.editReply({
      content: `❌ Erro durante o setup: ${(error as Error).message}`,
    });
  }
};

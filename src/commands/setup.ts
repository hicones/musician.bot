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
import { createPlayerEmbed, getPlayerAttachments, getPlayerButtons } from "../utils/player-embed.js";
import { createStepEmbed } from "../utils/setup-embed.js";
import { MusicManager } from "../music/music-manager.js";
import { getGuildConfig, saveGuildConfig } from "../database/db.js";
import { isAdminUser } from "../utils/auth.js";
import { performSetup } from "./setup-steps.js";

export const setupCommandData = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configura o bot de música no servidor");

export const handleSetupCommand = async (
  interaction: ChatInputCommandInteraction,
  musicManager: MusicManager,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Você não tem permissão para usar este comando. Apenas admins configurados podem executar o setup.",
      ephemeral: true,
    });
  }

  if (!interaction.guild || !interaction.guildId) {
    return interaction.reply({
      content: "❌ Este comando só pode ser usado em um servidor.",
      ephemeral: true,
    });
  }

  const botPermissions = interaction.guild.members.me?.permissions;
  if (
    !botPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    !botPermissions?.has(PermissionFlagsBits.SendMessages) ||
    !botPermissions?.has(PermissionFlagsBits.AddReactions)
  ) {
    return interaction.reply({
      content: "❌ O bot não tem permissões suficientes. Preciso de: Gerenciar Canais, Enviar Mensagens, e Adicionar Reações.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    let musicChannel = guild.channels.cache.find(
      (c) => c.name === "music-room" && c.type === ChannelType.GuildText,
    ) as TextChannel;

    if (musicChannel) {
      return handleExistingChannel(interaction, musicChannel, musicManager);
    }

    return handleNewChannel(interaction, guild, musicManager);
  } catch (error) {
    console.error("[Setup Command Error]", error);
    await interaction.editReply({
      content: `❌ Erro durante o setup: ${(error as Error).message}`,
    });
  }
};

const handleExistingChannel = async (
  interaction: ChatInputCommandInteraction,
  musicChannel: TextChannel,
  musicManager: MusicManager,
) => {
  const existingConfig = getGuildConfig(interaction.guildId!);

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

  const collector = message.createMessageComponentCollector({ time: 30000 });
  let confirmed = false;

  collector.on("collect", async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      return buttonInteraction.reply({ content: "Você não pode usar este botão.", ephemeral: true });
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
      return interaction.editReply({ content: "❌ Setup cancelado.", embeds: [], components: [] });
    }

    const progressEmbed = new EmbedBuilder()
      .setTitle("🔧 Configurando...")
      .setDescription("Aguarde enquanto configuramos o bot de música.")
      .setColor(0x0099ff)
      .setTimestamp();

    await interaction.editReply({ embeds: [progressEmbed], components: [] });

    const queue = musicManager.distube.getQueue(interaction.guildId!);
    if (queue) {
      try {
        musicManager.stopAndClearQueue(interaction.guildId!);
        console.log(`[Setup] Fila interrompida no servidor ${interaction.guild?.name}`);
      } catch (error) {
        console.warn(`[Setup] Erro ao interromper fila: ${(error as Error).message}`);
      }
    }

    musicManager.clearHistory(interaction.guildId!);

    const result = await performSetup(interaction.guildId!, interaction.user.id, musicChannel, musicManager);
    const resultEmbed = createStepEmbed(
      result.success ? "✅ Setup concluído com sucesso!" : "⚠️ Setup concluído com avisos",
      result.steps,
      result.success,
    );

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
  });
};

const handleNewChannel = async (interaction: ChatInputCommandInteraction, guild: any, musicManager: MusicManager) => {
  try {
    const musicChannel = await guild.channels.create({
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

    const progressEmbed = new EmbedBuilder()
      .setTitle("🔧 Configurando...")
      .setDescription("Criando canal e configurando player...")
      .setColor(0x0099ff)
      .setTimestamp();

    await interaction.editReply({ embeds: [progressEmbed] });

    const result = await performSetup(interaction.guildId!, interaction.user.id, musicChannel, musicManager);
    const resultEmbed = createStepEmbed(
      result.success ? "✅ Setup concluído com sucesso!" : "⚠️ Setup concluído com avisos",
      result.steps,
      result.success,
    );

    const successRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setURL(`https://discord.com/channels/${interaction.guildId}/${result.channelId || ""}`)
        .setLabel("Ir para o canal")
        .setStyle(ButtonStyle.Link)
        .setDisabled(!result.channelId),
    );

    await interaction.editReply({ embeds: [resultEmbed], components: [successRow] });
  } catch (error) {
    return interaction.editReply({ content: `❌ Erro ao criar canal: ${(error as Error).message}` });
  }
};
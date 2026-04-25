import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getPlaylists } from "../database/db";
import { isAdminUser } from "../utils/auth";

export const deletePlaylistCommandData = new SlashCommandBuilder()
  .setName("delete-playlist")
  .setDescription("Exclui uma playlist salva");

export const handleDeletePlaylistCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para excluir playlists.",
      ephemeral: true,
    });
  }

  const playlists = getPlaylists(interaction.guildId!);
  if (playlists.length === 0) {
    return interaction.reply({
      content: "Nao ha playlists salvas neste servidor.",
      ephemeral: true,
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("delete_playlist_select")
    .setPlaceholder("Escolha uma playlist para excluir...")
    .addOptions(
      playlists.slice(0, 25).map((playlist) => ({
        label: playlist.name.slice(0, 100),
        value: playlist.id.toString(),
      })),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({
    content: "Selecione a playlist que deseja excluir.",
    components: [row],
    ephemeral: true,
  });
};

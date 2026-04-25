import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { deleteFavoriteSong, getFavoriteSongs } from "../database/db";
import { isAdminUser } from "../utils/auth";

export const removeFavoriteCommandData = new SlashCommandBuilder()
  .setName("remove-favorite")
  .setDescription("Remove uma faixa dos favoritos")
  .addStringOption((option) =>
    option
      .setName("faixa")
      .setDescription("Faixa favoritada que sera removida")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const handleRemoveFavoriteCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para remover favoritos.",
      ephemeral: true,
    });
  }

  const favoriteId = Number(interaction.options.getString("faixa", true));
  const favorite = getFavoriteSongs(interaction.guildId!).find(
    (song) => song.id === favoriteId,
  );

  if (!favorite) {
    return interaction.reply({
      content: "Favorito nao encontrado neste servidor.",
      ephemeral: true,
    });
  }

  const deleted = deleteFavoriteSong(favoriteId, interaction.guildId!);

  await interaction.reply({
    content: deleted
      ? `Favorito **${favorite.title}** removido com sucesso.`
      : "Nao foi possivel remover o favorito selecionado.",
    ephemeral: true,
  });
};

export const handleRemoveFavoriteAutocomplete = async (
  interaction: AutocompleteInteraction,
) => {
  if (!interaction.guildId || !isAdminUser(interaction.user.id)) {
    return interaction.respond([]);
  }

  const focusedValue = normalizeSearchValue(interaction.options.getFocused());
  const options = getFavoriteSongs(interaction.guildId)
    .filter((song) => normalizeSearchValue(song.title).includes(focusedValue))
    .slice(0, 25)
    .map((song) => ({
      name: formatFavoriteOptionName(song.title, song.duration),
      value: song.id.toString(),
    }));

  return interaction.respond(options);
};

const normalizeSearchValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const formatFavoriteOptionName = (title: string, duration?: string) => {
  const label = duration ? `${title} - ${duration}` : title;
  return label.slice(0, 100);
};

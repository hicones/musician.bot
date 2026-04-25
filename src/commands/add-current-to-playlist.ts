import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { Song } from "distube";
import {
  addPlaylistSong,
  getPlaylists,
  savePlaylist,
  type SongData,
} from "../database/db";
import { MusicManager } from "../music/music-manager";

export const addCurrentToPlaylistCommandData = new SlashCommandBuilder()
  .setName("add-current-to-playlist")
  .setDescription("Salva a faixa atual em uma playlist")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("existente")
      .setDescription("Adiciona a faixa atual em uma playlist existente")
      .addStringOption((option) =>
        option
          .setName("playlist")
          .setDescription("Playlist que recebera a faixa atual")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("nova")
      .setDescription("Cria uma playlist nova com a faixa atual")
      .addStringOption((option) =>
        option
          .setName("nome")
          .setDescription("Nome da nova playlist")
          .setRequired(true)
          .setMaxLength(100),
      ),
  );

export const handleAddCurrentToPlaylistCommand = async (
  interaction: ChatInputCommandInteraction,
  musicManager: MusicManager,
) => {
  const queue = musicManager.distube.getQueue(interaction.guildId!);
  const currentSong = queue?.songs[0];

  if (!currentSong?.url) {
    return interaction.reply({
      content: "Nao ha uma faixa tocando agora para salvar.",
      ephemeral: true,
    });
  }

  const songData = createSongData(currentSong);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "existente") {
    const playlistId = Number(interaction.options.getString("playlist", true));
    const playlist = getPlaylists(interaction.guildId!).find(
      (item) => item.id === playlistId,
    );

    if (!playlist) {
      return interaction.reply({
        content: "Playlist nao encontrada neste servidor.",
        ephemeral: true,
      });
    }

    const added = addPlaylistSong(playlistId, interaction.guildId!, songData);
    return interaction.reply({
      content: added
        ? `Faixa **${songData.title}** adicionada em **${playlist.name}**.`
        : "Nao foi possivel adicionar a faixa na playlist selecionada.",
      ephemeral: true,
    });
  }

  if (subcommand === "nova") {
    const playlistName = interaction.options.getString("nome", true).trim();
    if (!playlistName) {
      return interaction.reply({
        content: "Informe um nome valido para a playlist.",
        ephemeral: true,
      });
    }

    savePlaylist(playlistName, interaction.user.id, interaction.guildId!, [
      songData,
    ]);

    return interaction.reply({
      content: `Playlist **${playlistName}** criada com **${songData.title}**.`,
      ephemeral: true,
    });
  }
};

export const handleAddCurrentToPlaylistAutocomplete = async (
  interaction: AutocompleteInteraction,
) => {
  if (!interaction.guildId) {
    return interaction.respond([]);
  }

  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name !== "playlist") {
    return interaction.respond([]);
  }

  const focusedValue = normalizeSearchValue(focusedOption.value);
  const options = getPlaylists(interaction.guildId)
    .filter((playlist) =>
      normalizeSearchValue(playlist.name).includes(focusedValue),
    )
    .slice(0, 25)
    .map((playlist) => ({
      name: playlist.name.slice(0, 100),
      value: playlist.id.toString(),
    }));

  return interaction.respond(options);
};

const createSongData = (song: Song): SongData => ({
  title: song.name || "Sem titulo",
  url: song.url!,
  duration: song.formattedDuration,
  thumbnail: song.thumbnail,
});

const normalizeSearchValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

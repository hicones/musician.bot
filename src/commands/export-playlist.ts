import {
  AttachmentBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getPlaylistSongsWithIds, getPlaylists } from "../database/db";

export const exportPlaylistCommandData = new SlashCommandBuilder()
  .setName("export-playlist")
  .setDescription("Exporta uma playlist salva em um arquivo")
  .addStringOption((option) =>
    option
      .setName("playlist")
      .setDescription("Playlist que sera exportada")
      .setRequired(true)
      .setAutocomplete(true),
  );

export const handleExportPlaylistCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
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

  const songs = getPlaylistSongsWithIds(playlist.id);
  const content = buildPlaylistCsvContent(playlist.name, songs);
  const attachment = new AttachmentBuilder(Buffer.from(content, "utf-8"), {
    name: `${sanitizeFilename(playlist.name)}.csv`,
  });

  await interaction.reply({
    content: `Export da playlist **${playlist.name}** gerado com ${songs.length} faixa(s).`,
    files: [attachment],
    ephemeral: true,
  });
};

export const handleExportPlaylistAutocomplete = async (
  interaction: AutocompleteInteraction,
) => {
  if (!interaction.guildId) {
    return interaction.respond([]);
  }

  const focusedValue = normalizeSearchValue(interaction.options.getFocused());
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

const buildPlaylistCsvContent = (
  playlistName: string,
  songs: ReturnType<typeof getPlaylistSongsWithIds>,
) => {
  const rows = [
    ["playlist", "title", "url", "duration", "thumbnail"],
    ...songs.map((song) => [
      playlistName,
      song.title,
      song.url,
      song.duration || "",
      song.thumbnail || "",
    ]),
  ];

  return `${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n")}\n`;
};

const escapeCsvValue = (value: string) => {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
};

const normalizeSearchValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const sanitizeFilename = (value: string) => {
  const filename = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return filename || "playlist";
};

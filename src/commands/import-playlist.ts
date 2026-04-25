import {
  Attachment,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { savePlaylist, type SongData } from "../database/db";
import { isAdminUser } from "../utils/auth";

const MAX_IMPORT_SIZE_BYTES = 512 * 1024;

export const importPlaylistCommandData = new SlashCommandBuilder()
  .setName("import-playlist")
  .setDescription("Importa uma playlist exportada")
  .addAttachmentOption((option) =>
    option
      .setName("arquivo")
      .setDescription("Arquivo .csv gerado pelo export de playlist")
      .setRequired(true),
  );

export const handleImportPlaylistCommand = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "Voce nao tem permissao para importar playlists.",
      ephemeral: true,
    });
  }

  const attachment = interaction.options.getAttachment("arquivo", true);
  if (!isValidPlaylistAttachment(attachment)) {
    return interaction.reply({
      content: "Envie um arquivo .csv de ate 512 KB gerado pelo export de playlist.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const content = await downloadAttachmentText(attachment);
    const parsed = parsePlaylistExport(content, attachment.name);

    if (parsed.songs.length === 0) {
      return interaction.editReply({
        content: "Nao encontrei faixas validas no arquivo enviado.",
      });
    }

    savePlaylist(
      parsed.name,
      interaction.user.id,
      interaction.guildId!,
      parsed.songs,
    );

    return interaction.editReply({
      content: `Playlist **${parsed.name}** importada com ${parsed.songs.length} faixa(s).`,
    });
  } catch (error) {
    console.error("[Import Playlist] Erro ao importar playlist:", error);
    return interaction.editReply({
      content: `Nao foi possivel importar a playlist: ${(error as Error).message}`,
    });
  }
};

const isValidPlaylistAttachment = (attachment: Attachment) => {
  return (
    attachment.name.toLowerCase().endsWith(".csv") &&
    attachment.size <= MAX_IMPORT_SIZE_BYTES
  );
};

const downloadAttachmentText = async (attachment: Attachment) => {
  const response = await fetch(attachment.url);
  if (!response.ok) {
    throw new Error(`falha ao baixar arquivo (${response.status} ${response.statusText}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.includes("text") && !contentType.includes("octet-stream")) {
    throw new Error("o arquivo enviado nao parece ser texto.");
  }

  return response.text();
};

const parsePlaylistExport = (content: string, fallbackFilename: string) => {
  const rows = parseCsv(content);
  const [header, ...dataRows] = rows;
  const columns = getColumnIndexes(header || []);
  if (columns.title === -1 || columns.url === -1) {
    throw new Error("CSV invalido. Colunas obrigatorias: title,url.");
  }

  const songs: SongData[] = [];
  let playlistName = "";

  for (const row of dataRows) {
    const title = getCsvValue(row, columns.title);
    const url = getCsvValue(row, columns.url);
    const duration = getCsvValue(row, columns.duration);
    const thumbnail = getCsvValue(row, columns.thumbnail);
    const rowPlaylistName = getCsvValue(row, columns.playlist);

    if (!title || !url || !/^https?:\/\//i.test(url)) {
      continue;
    }

    if (!playlistName && rowPlaylistName) {
      playlistName = rowPlaylistName;
    }

    songs.push({
      title,
      url,
      duration: duration || undefined,
      thumbnail: thumbnail || undefined,
    });
  }

  return {
    name: sanitizePlaylistName(playlistName || fallbackFilename.replace(/\.csv$/i, "")),
    songs,
  };
};

const parseCsv = (content: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      value += '"';
      index++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index++;
      }

      row.push(value);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  return rows;
};

const getColumnIndexes = (header: string[]) => {
  const normalizedHeader = header.map((column) => column.trim().toLowerCase());
  return {
    playlist: normalizedHeader.indexOf("playlist"),
    title: normalizedHeader.indexOf("title"),
    url: normalizedHeader.indexOf("url"),
    duration: normalizedHeader.indexOf("duration"),
    thumbnail: normalizedHeader.indexOf("thumbnail"),
  };
};

const getCsvValue = (row: string[], index: number) => {
  return index >= 0 ? (row[index] || "").trim() : "";
};

const sanitizePlaylistName = (value: string) => {
  const name = value.replace(/\s+/g, " ").trim().slice(0, 100);
  return name || "Playlist importada";
};

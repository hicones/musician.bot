import { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Queue, Song } from "distube";
import path from "path";

const EMBED_DESCRIPTION_LIMIT = 4096;
const QUEUE_HEADER = "**Fila Atual**\n";
const QUEUE_FOOTER_RESERVE = 140;
const QUEUE_LIST_LIMIT = EMBED_DESCRIPTION_LIMIT - QUEUE_HEADER.length - QUEUE_FOOTER_RESERVE;
export const QUEUE_PAGE_SIZE = 50;

export const BANNER_PATH = path.join(__dirname, "../../assets/banner.png");
export const PLACEHOLDER_PATH = path.join(
  __dirname,
  "../../assets/placeholder.png",
);

export const createPlayerEmbed = (
  queue: Queue | undefined,
  history: Song[],
  showQueue: boolean = false,
  queuePage: number = 0,
) => {
  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("Musician Bot");

  if (!queue || !queue.songs.length) {
    embed.setDescription(
      "**Fila vazia**\n\nCole uma URL ou digite o nome de uma musica neste canal para comecar a tocar!",
    );
    embed.setImage("attachment://placeholder.png");
    return embed;
  }

  const currentSong = queue.songs[0];

  if (showQueue) {
    const queueLines = buildQueueLines(queue, history, currentSong);
    const pageInfo = getQueuePageInfo(queue, history, queuePage);
    const pageStart = pageInfo.page * QUEUE_PAGE_SIZE;
    const pageLines = queueLines.slice(pageStart, pageStart + QUEUE_PAGE_SIZE);
    const { visibleLines, hiddenCount } = fitQueueLines(pageLines);
    const queueList = visibleLines.join("\n");
    const hiddenText = hiddenCount > 0
      ? "\n\nAlguns itens desta pagina foram ocultados pelo limite do Discord."
      : "";

    embed.setDescription(
      `${QUEUE_HEADER}Pagina ${pageInfo.page + 1}/${pageInfo.totalPages} - ${pageInfo.totalItems} musicas\n\n${queueList || "Nenhuma musica na fila."}${hiddenText}`,
    );
  } else {
    embed.setDescription(
      `**Tocando agora:**\n[${currentSong.name}](${currentSong.url})`,
    );
    embed.addFields(
      {
        name: "Duracao",
        value: currentSong.formattedDuration || "Desconhecida",
        inline: true,
      },
      {
        name: "Pedido por",
        value: currentSong.user?.username || "Sistema",
        inline: true,
      },
    );
    embed.setImage(currentSong.thumbnail || "attachment://placeholder.png");
  }

  const status = [];
  if (queue.paused) status.push("Pausado");
  if (queue.repeatMode === 1) status.push("Musica em loop");
  if (queue.repeatMode === 2) status.push("Fila em loop");

  if (status.length) {
    embed.setFooter({ text: `Status: ${status.join(" | ")}` });
  }

  return embed;
};

export const getQueuePageInfo = (
  queue: Queue | undefined,
  history: Song[],
  requestedPage: number = 0,
) => {
  if (!queue || !queue.songs.length) {
    return {
      page: 0,
      totalPages: 1,
      totalItems: 0,
    };
  }

  const queueLines = buildQueueLines(queue, history, queue.songs[0]);
  const totalItems = queueLines.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / QUEUE_PAGE_SIZE));
  const safeRequestedPage = Number.isFinite(requestedPage) ? requestedPage : 0;
  const page = Math.min(Math.max(Math.trunc(safeRequestedPage), 0), totalPages - 1);

  return {
    page,
    totalPages,
    totalItems,
  };
};

const buildQueueLines = (queue: Queue, history: Song[], currentSong: Song) => {
  const queueLines: string[] = [];
  const historySongs = history.filter((song) => song.id !== currentSong.id);

  historySongs.forEach((song, index) => {
    queueLines.push(`${index + 1}. ${formatQueueSong(song)} [tocada]`);
  });

  queueLines.push(`${historySongs.length + 1}. ${formatQueueSong(currentSong)} [tocando]`);

  queue.songs.slice(1).forEach((song, index) => {
    queueLines.push(`${historySongs.length + index + 2}. ${formatQueueSong(song)}`);
  });

  return queueLines;
};

const formatQueueSong = (song: Song) => {
  return `${song.name || "Sem titulo"} - ${song.formattedDuration || "Desconhecida"}`;
};

const fitQueueLines = (lines: string[]) => {
  const visibleLines: string[] = [];
  let length = 0;

  for (const line of lines) {
    const nextLength = length + line.length + 1;
    if (nextLength > QUEUE_LIST_LIMIT) {
      break;
    }

    visibleLines.push(line);
    length = nextLength;
  }

  return {
    visibleLines,
    hiddenCount: lines.length - visibleLines.length,
  };
};

export const getPlayerAttachments = () => {
  return [
    new AttachmentBuilder(BANNER_PATH, { name: "banner.png" }),
    new AttachmentBuilder(PLACEHOLDER_PATH, { name: "placeholder.png" }),
  ];
};

export const getPlayerButtons = (): ActionRowBuilder<ButtonBuilder>[] => {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("view_queue:0")
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

  return [row];
};

import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { Queue, Song } from "distube";
import path from "path";

const EMBED_DESCRIPTION_LIMIT = 4096;
const QUEUE_HEADER = "**Fila Atual**\n\n";
const QUEUE_FOOTER_RESERVE = 140;
const QUEUE_LIST_LIMIT = EMBED_DESCRIPTION_LIMIT - QUEUE_HEADER.length - QUEUE_FOOTER_RESERVE;

export const BANNER_PATH = path.join(__dirname, "../../assets/banner.png");
export const PLACEHOLDER_PATH = path.join(
  __dirname,
  "../../assets/placeholder.png",
);

export const createPlayerEmbed = (
  queue: Queue | undefined,
  history: Song[],
  showQueue: boolean = false,
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
    const { visibleLines, hiddenCount } = fitQueueLines(queueLines);
    const queueList = visibleLines.join("\n");
    const hiddenText = hiddenCount > 0 ? `\n\n... e mais ${hiddenCount} musicas na fila.` : "";

    embed.setDescription(
      `${QUEUE_HEADER}${queueList || "Nenhuma musica na fila."}${hiddenText}`,
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

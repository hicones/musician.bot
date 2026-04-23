import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { Queue, Song } from "distube";
import path from "path";

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
    .setTitle("🎵 Musician Bot");

  if (!queue || !queue.songs.length) {
    embed.setDescription(
      "**Fila vazia**\n\nCole uma URL de música neste canal para começar a tocar!",
    );
    embed.setImage("attachment://placeholder.png");
    return embed;
  }

  const currentSong = queue.songs[0];

  if (showQueue) {
    // Formatting the queue as requested:
    // 1. Guns N Roses - 03:14 [check]
    // 2. Bohemian Rhapsody - 05:34 [Tocando]

    let queueList = "";

    // History (played songs)
    const historySongs = history.filter((s) => s.id !== currentSong.id);
    historySongs.forEach((song, index) => {
      queueList += `${index + 1}. ${song.name} - ${song.formattedDuration} [☑️]\n`;
    });

    // Current song
    queueList += `${historySongs.length + 1}. ${currentSong.name} - ${currentSong.formattedDuration} [🎧]\n`;

    // Remaining songs in queue
    queue.songs.slice(1).forEach((song, index) => {
      queueList += `${historySongs.length + index + 2}. ${song.name} - ${song.formattedDuration} °\n`;
    });

    embed.setDescription(
      `**Fila Atual**\n\n${queueList || "Nenhuma música na fila."}`,
    );
  } else {
    embed.setDescription(
      `**Tocando agora:**\n[${currentSong.name}](${currentSong.url})`,
    );
    embed.addFields(
      {
        name: "Duração",
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
  if (queue.paused) status.push("⏸️ Pausado");
  if (queue.repeatMode === 1) status.push("🔂 Música");
  if (queue.repeatMode === 2) status.push("🔁 Fila");
  // if (queue.shuffle) status.push('🔀 Shuffle On');

  if (status.length) {
    embed.setFooter({ text: `Status: ${status.join(" | ")}` });
  }

  return embed;
};

export const getPlayerAttachments = () => {
  return [
    new AttachmentBuilder(BANNER_PATH, { name: "banner.png" }),
    new AttachmentBuilder(PLACEHOLDER_PATH, { name: "placeholder.png" }),
  ];
};

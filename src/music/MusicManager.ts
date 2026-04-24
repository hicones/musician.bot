import { Client, TextChannel } from 'discord.js';
import { DisTube, Song } from 'distube';
import { createPlayerEmbed } from '../utils/playerEmbed';
import { formatError } from '../utils/formatError';
import { SafeYtDlpPlugin } from './SafeYtDlpPlugin';

export interface PlayedSong {
  title: string;
  duration: string;
  status: 'check' | 'Tocando' | 'Fila';
}

export class MusicManager {
  public distube: DisTube;
  private playedSongs: Map<string, Song[]> = new Map(); // guildId -> Song[]

  constructor(client: Client) {
    this.distube = new DisTube(client, {
      plugins: [new SafeYtDlpPlugin()],
    });

    this.setupEvents();
  }

  private setupEvents() {
    (this.distube as any)
      .on('playSong', (queue: any, song: any) => {
        console.log(`[Music] Tocando agora: "${song.name}" em "${queue.textChannel?.guild.name}"`);
        this.addToPlayed(queue.id!, song);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
      })
      .on('addSong', (queue: any, song: any) => {
        console.log(`[Music] Música adicionada: "${song.name}" por ${song.user?.tag}`);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
      })
      .on('addList', (queue: any, playlist: any) => {
        console.log(`[Music] Playlist adicionada: "${playlist.name}" (${playlist.songs.length} músicas)`);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
      })
      .on('error', (error: Error, queue: any, song?: Song) => {
        const guildName = queue?.textChannel?.guild?.name || queue?.id || 'desconhecido';
        const songName = song?.name ? ` | Musica: "${song.name}"` : '';
        console.error(`[Music Error] Servidor: ${guildName}${songName}`);
        console.error(formatError(error));
      })
      .on('finish', (queue: any) => {
        console.log(`[Music] Fila finalizada em "${queue.textChannel?.guild.name}"`);
      });
  }

  private addToPlayed(guildId: string, song: Song) {
    if (!this.playedSongs.has(guildId)) {
      this.playedSongs.set(guildId, []);
    }
    const history = this.playedSongs.get(guildId)!;
    // Check if song is already in history to avoid duplicates if it's playing again
    if (!history.find(s => s.id === song.id)) {
      history.push(song);
    }
  }

  public getHistory(guildId: string): Song[] {
    return this.playedSongs.get(guildId) || [];
  }

  public async updatePlayerMessage(channel: TextChannel) {
    if (!channel) return;
    
    // Find the controller message in the music-room
    const messages = await channel.messages.fetch({ limit: 10 });
    const controllerMsg = messages.find(m => m.embeds.length > 0 && m.author.id === channel.client.user?.id);
    
    if (controllerMsg) {
      const queue = this.distube.getQueue(channel.guildId);
      const history = this.getHistory(channel.guildId);
      const embed = createPlayerEmbed(queue, history);
      await controllerMsg.edit({ embeds: [embed] });
    }
  }

  public clearHistory(guildId: string) {
    this.playedSongs.set(guildId, []);
  }
}

import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DisTube, Song } from 'distube';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { createPlayerEmbed, getPlayerAttachments, getPlayerButtons } from '../utils/playerEmbed';
import { formatError } from '../utils/formatError';
import { SafeYtDlpPlugin } from './SafeYtDlpPlugin';
import { SafeSpotifyPlugin, SafeSpotifyPluginOptions } from './SafeSpotifyPlugin';
import { ActivityManager } from '../activity/ActivityManager';

export interface PlayedSong {
  title: string;
  duration: string;
  status: 'check' | 'Tocando' | 'Fila';
}

export class MusicManager {
  public distube: DisTube;
  public activityManager: ActivityManager;
  private playedSongs: Map<string, Song[]> = new Map(); // guildId -> Song[]

  constructor(client: Client) {
    this.distube = new DisTube(client, {
      plugins: [
        new SafeSpotifyPlugin(this.getSpotifyOptions()),
        new SafeYtDlpPlugin(),
        new SoundCloudPlugin(),
      ],
    });

    this.activityManager = new ActivityManager(this.distube);
    this.setupEvents();
  }

  private setupEvents() {
    (this.distube as any)
      .on('playSong', (queue: any, song: any) => {
        console.log(`[Music] Tocando agora: "${song.name}" em "${queue.textChannel?.guild.name}"`);
        this.addToPlayed(queue.id!, song);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
        this.activityManager.onPlaySong(queue);
      })
      .on('addSong', (queue: any, song: any) => {
        console.log(`[Music] Música adicionada: "${song.name}" por ${song.user?.tag}`);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
        this.activityManager.onAddSong(queue);
      })
      .on('addList', (queue: any, playlist: any) => {
        console.log(`[Music] Playlist adicionada: "${playlist.name}" (${playlist.songs.length} músicas)`);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
        this.activityManager.onAddList(queue);
      })
      .on('error', (error: Error, queue: any, song?: Song) => {
        const guildName = queue?.textChannel?.guild?.name || queue?.id || 'desconhecido';
        const songName = song?.name ? ` | Musica: "${song.name}"` : '';
        console.error(`[Music Error] Servidor: ${guildName}${songName}`);
        console.error(formatError(error));
      })
      .on('finish', (queue: any) => {
        console.log(`[Music] Fila finalizada em "${queue.textChannel?.guild.name}"`);
        this.updatePlayerMessage(queue.textChannel as TextChannel);
        this.activityManager.onFinish(queue);
      })
      .on('empty', (queue: any) => {
        console.log(`[Music] Fila vazia/empty em "${queue.textChannel?.guild.name}"`);
        this.activityManager.onFinish(queue);
      })
      .on('disconnect', (queue: any) => {
        console.log(`[Music] Bot desconectado em "${queue.textChannel?.guild.name}"`);
        this.activityManager.onDisconnect(queue);
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
    
    const messages = await channel.messages.fetch({ limit: 10 });
    const controllerMsg = messages.find(m => m.embeds.length > 0 && m.author.id === channel.client.user?.id);
    
    if (controllerMsg) {
      const queue = this.distube.getQueue(channel.guildId);
      const history = this.getHistory(channel.guildId);
      const embed = createPlayerEmbed(queue, history);
      const components = getPlayerButtons();
      
      const attachments = getPlayerAttachments();
      const payload: any = { embeds: [embed], components };

      const imageUrl = (embed.data as any).image?.url;
      if (imageUrl === 'attachment://banner.png') {
        payload.files = [attachments[0]];
      } else if (imageUrl === 'attachment://placeholder.png') {
        payload.files = [attachments[1]];
      } else {
        payload.files = [];
      }

      await controllerMsg.edit(payload);
    }
  }

  public clearHistory(guildId: string) {
    this.playedSongs.set(guildId, []);
  }

  private getSpotifyOptions(): SafeSpotifyPluginOptions {
    const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN?.trim();
    const topTracksCountry = process.env.SPOTIFY_TOP_TRACKS_COUNTRY?.trim().toUpperCase();

    if (!clientId || !clientSecret) {
      console.warn('[Spotify] Credenciais nao configuradas. Playlists/albums grandes podem ficar limitados a 100 faixas.');
      return {};
    }

    console.log(
      `[Spotify] Credenciais carregadas (${this.maskSecret(clientId)} / ${this.maskSecret(clientSecret)})` +
        `${refreshToken ? ' com refresh token de usuario' : ' sem refresh token de usuario'}.`,
    );

    return {
      refreshToken,
      api: {
        clientId,
        clientSecret,
        ...(topTracksCountry && /^[A-Z]{2}$/.test(topTracksCountry) ? { topTracksCountry } : {}),
      },
    };
  }

  private maskSecret(value: string) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}

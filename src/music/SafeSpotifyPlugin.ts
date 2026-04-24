import { Playlist, ResolveOptions, Song } from 'distube';
import { SpotifyPlugin, SpotifyPluginOptions } from '@distube/spotify';
import { Details, Preview, SpotifyUrlInfoModule, Track } from 'spotify-url-info';

export type SafeSpotifyPluginOptions = SpotifyPluginOptions & {
  refreshToken?: string;
};

const spotifyUrlInfo = require('spotify-url-info') as SpotifyUrlInfoModule;
const spotifyInfo = spotifyUrlInfo(fetch);

const getSpotifyId = (uriOrUrl: string | undefined, fallback: string) => {
  if (!uriOrUrl) return fallback;
  return uriOrUrl.split(/[/:]/).filter(Boolean).pop() || fallback;
};

const getTrackUrl = (track: Track, fallbackId: string) => {
  return `https://open.spotify.com/track/${getSpotifyId(track.uri, fallbackId)}`;
};

export class SafeSpotifyPlugin extends SpotifyPlugin {
  private readonly hasCredentials: boolean;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly refreshToken?: string;
  private token?: string;
  private tokenExpiresAt = 0;

  constructor(options?: SafeSpotifyPluginOptions) {
    const { refreshToken, ...spotifyOptions } = options || {};
    super(spotifyOptions);
    this.hasCredentials = Boolean(spotifyOptions.api?.clientId && spotifyOptions.api.clientSecret);
    this.clientId = spotifyOptions.api?.clientId;
    this.clientSecret = spotifyOptions.api?.clientSecret;
    this.refreshToken = refreshToken;
  }

  async resolve<T>(url: string, options: ResolveOptions<T>): Promise<Song<T> | Playlist<T>> {
    if (this.hasCredentials && this.isPlaylistUrl(url)) {
      try {
        return await this.resolvePlaylistWithApi(url, options);
      } catch (error) {
        console.warn('[Spotify] Web API nao conseguiu resolver a playlist completa. Usando fallback limitado a 100 faixas.');
        if (error instanceof Error && error.message.includes('403')) {
          console.warn(
            '[Spotify] 403 Forbidden normalmente indica playlist privada/restrita. ' +
              'Configure SPOTIFY_REFRESH_TOKEN com escopo playlist-read-private para acessar playlists privadas do usuario.',
          );
        }
        console.warn(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        return this.resolveWithScraper(url, options);
      }
    }

    try {
      const resolved = await super.resolve(url, options);
      this.logResolvedPlaylist('Spotify plugin', resolved);
      return resolved;
    } catch (error) {
      if (!this.validate(url)) {
        throw error;
      }

      console.warn(
        `[Spotify] API oficial falhou${this.hasCredentials ? ' mesmo com credenciais configuradas' : ''}. ` +
          'Usando fallback por scraping, limitado a ate 100 faixas.',
      );
      console.warn(error instanceof Error ? `${error.name}: ${error.message}` : String(error));

      return this.resolveWithScraper(url, options);
    }
  }

  private isPlaylistUrl(url: string) {
    return /^https?:\/\/open\.spotify\.com\/playlist\//i.test(url);
  }

  private getPlaylistId(url: string) {
    return new URL(url).pathname.split('/').filter(Boolean)[1];
  }

  private async resolvePlaylistWithApi<T>(url: string, options: ResolveOptions<T>): Promise<Playlist<T>> {
    const playlistId = this.getPlaylistId(url);
    if (!playlistId) {
      throw new Error('Playlist Spotify invalida.');
    }

    const token = await this.getAccessToken();
    const playlist = await this.fetchSpotifyApi<any>(
      `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,external_urls.spotify,images,tracks(total)`,
      token,
    );
    const tracks = await this.fetchPlaylistTracks(playlistId, token);
    const songs = tracks.map((track, index): Song<T> => this.createSongFromApiTrack(track, options, index));

    console.log(`[Spotify] Web API resolveu playlist "${playlist.name}" com ${songs.length} faixas.`);

    return new Playlist(
      {
        source: 'spotify',
        name: playlist.name,
        url: playlist.external_urls?.spotify || url,
        thumbnail: playlist.images?.[0]?.url,
        songs,
      },
      options,
    );
  }

  private async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Credenciais Spotify ausentes.');
    }

    if (this.refreshToken) {
      try {
        return await this.requestAccessToken(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
          }),
          'refresh_token',
        );
      } catch (error) {
        console.warn('[Spotify] Falha ao usar SPOTIFY_REFRESH_TOKEN. Tentando client_credentials.');
        console.warn(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      }
    }

    return this.requestAccessToken(
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      'client_credentials',
    );
  }

  private async requestAccessToken(bodyParams: URLSearchParams, grantType: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Credenciais Spotify ausentes.');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
    });

    if (!response.ok) {
      const details = await this.readErrorBody(response);
      throw new Error(
        `Falha ao obter token Spotify via ${grantType} (${response.status} ${response.statusText})${details ? `: ${details}` : ''}.`,
      );
    }

    const body = await response.json() as { access_token: string; expires_in: number };
    this.token = body.access_token;
    this.tokenExpiresAt = Date.now() + body.expires_in * 1000 - 5000;
    return this.token;
  }

  private async readErrorBody(response: Response) {
    try {
      const body = await response.json() as { error?: string; error_description?: string };
      return [body.error, body.error_description].filter(Boolean).join(' - ');
    } catch {
      return '';
    }
  }

  private async fetchPlaylistTracks(playlistId: string, token: string) {
    const tracks: any[] = [];
    let next: string | null =
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,duration_ms,external_urls.spotify,artists(name),album(images)))`;

    while (next) {
      const page: { items?: { track?: any }[]; next?: string | null } = await this.fetchSpotifyApi(next, token);
      for (const item of page.items || []) {
        if (item.track?.id && item.track?.name) {
          tracks.push(item.track);
        }
      }
      next = page.next || null;
    }

    return tracks;
  }

  private async fetchSpotifyApi<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API respondeu ${response.status} ${response.statusText}.`);
    }

    return response.json() as Promise<T>;
  }

  private createSongFromApiTrack<T>(track: any, options: ResolveOptions<T>, index: number): Song<T> {
    return new Song(
      {
        plugin: this,
        source: 'spotify',
        playFromSource: false,
        id: track.id || `spotify-track-${index}`,
        name: track.name,
        url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
        duration: typeof track.duration_ms === 'number' ? track.duration_ms / 1000 : undefined,
        thumbnail: track.album?.images?.[0]?.url,
        uploader: {
          name: Array.isArray(track.artists) ? track.artists.map((artist: any) => artist.name).join(', ') : undefined,
        },
      },
      options,
    );
  }

  private async resolveWithScraper<T>(url: string, options: ResolveOptions<T>): Promise<Song<T> | Playlist<T>> {
    const details = await spotifyInfo.getDetails(url);

    if (details.tracks.length > 0) {
      return this.createPlaylistFromDetails(details, options);
    }

    return this.createSongFromPreview(details.preview, options);
  }

  private createPlaylistFromDetails<T>(details: Details, options: ResolveOptions<T>): Playlist<T> {
    const playlist = new Playlist(
      {
        source: 'spotify',
        name: details.preview.title,
        url: details.preview.link,
        thumbnail: details.preview.image,
        songs: details.tracks.map((track, index): Song<T> => this.createSongFromTrack(track, options, index)),
      },
      options,
    );

    if (details.tracks.length >= 100) {
      console.warn(
        `[Spotify] Fallback retornou ${details.tracks.length} faixas para "${details.preview.title}". ` +
          'Esse fallback nao consegue buscar alem das primeiras 100 faixas.',
      );
    }

    return playlist;
  }

  private createSongFromPreview<T>(preview: Preview, options: ResolveOptions<T>): Song<T> {
    return new Song(
      {
        plugin: this,
        source: 'spotify',
        playFromSource: false,
        id: getSpotifyId(preview.link, preview.track),
        name: preview.track || preview.title,
        url: preview.link,
        thumbnail: preview.image,
        uploader: {
          name: preview.artist,
        },
      },
      options,
    );
  }

  private createSongFromTrack<T>(track: Track, options: ResolveOptions<T>, index: number): Song<T> {
    const id = getSpotifyId(track.uri, `spotify-track-${index}`);

    return new Song(
      {
        plugin: this,
        source: 'spotify',
        playFromSource: false,
        id,
        name: track.name,
        url: getTrackUrl(track, id),
        duration: track.duration ? track.duration / 1000 : undefined,
        uploader: {
          name: track.artist,
        },
      },
      options,
    );
  }

  private logResolvedPlaylist<T>(source: string, resolved: Song<T> | Playlist<T>) {
    if (resolved instanceof Playlist) {
      console.log(`[Spotify] ${source} resolveu playlist "${resolved.name}" com ${resolved.songs.length} faixas.`);
      if (!this.hasCredentials && resolved.songs.length >= 100) {
        console.warn('[Spotify] Sem credenciais, playlists/albums grandes podem ficar limitados a 100 faixas.');
      }
    }
  }
}

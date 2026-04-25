import { DisTubeError, ExtractorPlugin, Playlist, ResolveOptions, Song } from 'distube';
import { json } from '@distube/yt-dlp';
import { existsSync } from 'fs';

type YtDlpVideo = {
  id: string;
  title?: string;
  fulltitle?: string;
  extractor?: string;
  webpage_url?: string;
  original_url?: string;
  is_live?: boolean;
  thumbnail?: string;
  thumbnails?: { url: string }[];
  duration?: number;
  uploader?: string;
  uploader_url?: string;
  view_count?: number;
  like_count?: number;
  dislike_count?: number;
  repost_count?: number;
  age_limit?: number;
  url?: string;
};

type YtDlpPlaylist = {
  entries: YtDlpVideo[];
  extractor?: string;
  id: string | number;
  title?: string;
  webpage_url?: string;
  thumbnails?: { url: string }[];
};

const STREAM_FORMATS = [
  'ba/ba*',
  'bestaudio/best',
  'ba*',
  'best',
];

const isPlaylist = (info: YtDlpVideo | YtDlpPlaylist): info is YtDlpPlaylist => {
  return Array.isArray((info as YtDlpPlaylist).entries);
};

export class SafeYtDlpPlugin extends ExtractorPlugin {
  validate(url: string) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url);
  }

  async resolve<T>(url: string, options: ResolveOptions<T>) {
    const isPlaylistUrl = /[?&]list=|\/playlist(?:\?|\/|$)/i.test(url);
    const info = await this.getInfo(url, isPlaylistUrl ? { flatPlaylist: true, yesPlaylist: true } : {});

    if (isPlaylist(info)) {
      if (info.entries.length === 0) {
        throw new DisTubeError('YTDLP_ERROR', 'The playlist is empty');
      }

      return new Playlist(
        {
          source: info.extractor || 'yt-dlp',
          songs: info.entries.map((entry) => new SafeYtDlpSong(this, entry, options)),
          id: info.id.toString(),
          name: info.title,
          url: info.webpage_url,
          thumbnail: info.thumbnails?.[0]?.url,
        },
        options,
      );
    }

    return new SafeYtDlpSong(this, info, options);
  }

  async getStreamURL(song: Song) {
    if (!song.url) {
      throw new DisTubeError('YTDLP_PLUGIN_INVALID_SONG', 'Cannot get stream url from invalid song.');
    }

    let lastError: unknown;
    for (const format of STREAM_FORMATS) {
      try {
        const info = await this.getInfo(song.url, { format });
        if (isPlaylist(info)) {
          throw new DisTubeError('YTDLP_ERROR', 'Cannot get stream URL of an entire playlist');
        }

        if (info.url) {
          return info.url;
        }

        lastError = new Error(`yt-dlp did not return a playable stream URL for format ${format}`);
      } catch (error) {
        lastError = error;
        if (!isRequestedFormatUnavailableError(error)) {
          throw error;
        }

        console.warn(`[YTDLP] Formato ${format} indisponivel para "${song.name}". Tentando fallback...`);
      }
    }

    throw new DisTubeError(
      'YTDLP_ERROR',
      lastError instanceof Error ? lastError.message : 'yt-dlp did not return a playable stream URL',
    );
  }

  getRelatedSongs() {
    return [];
  }

  async searchSong<T>(query: string, options: ResolveOptions<T>) {
    const firstResult =
      (await this.searchYouTubeMusic(query)) ||
      (await this.searchYouTube(query));

    if (!firstResult) {
      return null;
    }

    return new SafeYtDlpSong(this, firstResult, options);
  }

  private async getInfo(url: string, extraFlags: Record<string, unknown> = {}) {
    return json(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true,
      simulate: true,
      ...getYtDlpAuthFlags(),
      ...extraFlags,
    }).catch((error) => {
      throw new DisTubeError('YTDLP_ERROR', error instanceof Error ? error.message : String(error));
    });
  }

  private async searchYouTubeMusic(query: string) {
    const info = await this.getInfo(getYouTubeMusicSearchUrl(query), { flatPlaylist: true });
    const entries = isPlaylist(info) ? info.entries : [info];
    const firstResult = entries.find(isPlayableSearchEntry);

    if (!firstResult) {
      return null;
    }

    return {
      ...firstResult,
      webpage_url: toYouTubeMusicWatchUrl(firstResult.webpage_url || firstResult.original_url || firstResult.url),
    };
  }

  private async searchYouTube(query: string) {
    const info = await this.getInfo(`ytsearch1:${query}`);
    const entries = isPlaylist(info) ? info.entries : [info];

    return entries.find(isPlayableSearchEntry) || null;
  }
}

const getYouTubeMusicSearchUrl = (query: string) => {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
};

const isPlayableSearchEntry = (entry: YtDlpVideo | undefined) => {
  if (!entry?.id || !entry.title) {
    return false;
  }

  const url = entry.webpage_url || entry.original_url || entry.url;
  return Boolean(url && /\/watch\?/i.test(url));
};

const toYouTubeMusicWatchUrl = (url: string | undefined) => {
  if (!url) return url;

  const videoId = new URL(url).searchParams.get('v');
  if (!videoId) return url;

  return `https://music.youtube.com/watch?v=${videoId}`;
};

const getYtDlpAuthFlags = () => {
  const cookiesPath = process.env.YTDLP_COOKIES_PATH?.trim();
  if (!cookiesPath) {
    return {};
  }

  if (!existsSync(cookiesPath)) {
    console.warn(`[YTDLP] YTDLP_COOKIES_PATH configurado, mas arquivo nao encontrado: ${cookiesPath}`);
    return {};
  }

  return {
    cookies: cookiesPath,
  };
};

const isRequestedFormatUnavailableError = (error: unknown) => {
  return error instanceof Error && /Requested format is not available/i.test(error.message);
};

class SafeYtDlpSong<T = unknown> extends Song<T> {
  constructor(plugin: SafeYtDlpPlugin, info: YtDlpVideo, options?: ResolveOptions<T>) {
    super(
      {
        plugin,
        source: info.extractor || 'yt-dlp',
        playFromSource: true,
        id: info.id,
        name: info.title || info.fulltitle,
        url: info.webpage_url || info.original_url || info.url,
        isLive: info.is_live,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        duration: info.is_live ? 0 : info.duration,
        uploader: {
          name: info.uploader,
          url: info.uploader_url,
        },
        views: info.view_count,
        likes: info.like_count,
        dislikes: info.dislike_count,
        reposts: info.repost_count,
        ageRestricted: (info.age_limit ?? 0) >= 18,
      },
      options,
    );
  }
}

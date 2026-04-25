import { DisTubeError, ExtractorPlugin, Playlist, ResolveOptions, Song } from 'distube';
import { json } from '@distube/yt-dlp';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

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

type YtDlpAuthProfile = {
  name: string;
  useCookies: boolean;
  extractorArgs?: string;
};

const DEFAULT_YOUTUBE_EXTRACTOR_ARGS = 'youtube:player_client=android_vr,web_safari';
const STREAM_FORMATS: Array<string | undefined> = [
  'ba/ba*',
  'bestaudio/best',
  'ba*',
  'best',
  undefined,
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
    const info = isPlaylistUrl
      ? await this.getInfo(url, { flatPlaylist: true, yesPlaylist: true })
      : await this.getInfoWithFormatFallback(url);

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
    for (const authProfile of getYtDlpAuthProfiles()) {
      for (const format of STREAM_FORMATS) {
        try {
          const info = await this.getInfo(song.url, getFormatFlags({}, format), authProfile);
          if (isPlaylist(info)) {
            throw new DisTubeError('YTDLP_ERROR', 'Cannot get stream URL of an entire playlist');
          }

          if (info.url) {
            return info.url;
          }

          lastError = new Error(`yt-dlp did not return a playable stream URL for format ${format || 'padrao'}`);
        } catch (error) {
          lastError = error;
          if (!isRequestedFormatUnavailableError(error)) {
            if (shouldTryNextAuthProfile(error, authProfile)) {
              console.warn(
                `[YTDLP] ${authProfile.name} falhou para "${song.name}". Tentando proximo perfil de autenticacao...`,
              );
              break;
            }

            throw error;
          }

          console.warn(
            `[YTDLP] Formato ${format || 'padrao'} indisponivel para "${song.name}" ` +
              `usando ${authProfile.name}. Tentando fallback...`,
          );
        }
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

  private async getInfo(
    url: string,
    extraFlags: Record<string, unknown> = {},
    authProfile: YtDlpAuthProfile = getDefaultYtDlpAuthProfile(),
  ) {
    return json(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true,
      simulate: true,
      ...getYtDlpAuthFlags(authProfile),
      ...extraFlags,
    }).catch((error) => {
      throw new DisTubeError('YTDLP_ERROR', error instanceof Error ? error.message : String(error));
    });
  }

  private async getInfoWithFormatFallback(url: string, extraFlags: Record<string, unknown> = {}) {
    let lastError: unknown;

    for (const authProfile of getYtDlpAuthProfiles()) {
      for (const format of STREAM_FORMATS) {
        try {
          return await this.getInfo(url, getFormatFlags(extraFlags, format), authProfile);
        } catch (error) {
          lastError = error;
          if (!isRequestedFormatUnavailableError(error)) {
            if (shouldTryNextAuthProfile(error, authProfile)) {
              console.warn(
                `[YTDLP] ${authProfile.name} falhou ao resolver ${url}. Tentando proximo perfil de autenticacao...`,
              );
              break;
            }

            throw error;
          }

          console.warn(
            `[YTDLP] Formato ${format || 'padrao'} indisponivel ao resolver ${url} ` +
              `usando ${authProfile.name}. Tentando fallback...`,
          );
        }
      }
    }

    throw new DisTubeError(
      'YTDLP_ERROR',
      lastError instanceof Error ? lastError.message : 'yt-dlp did not return video info',
    );
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

const getDefaultYtDlpAuthProfile = (): YtDlpAuthProfile => ({
  name: 'cookies/clientes padrao',
  useCookies: true,
  extractorArgs: getYouTubeExtractorArgs(),
});

const getYtDlpAuthProfiles = (): YtDlpAuthProfile[] => {
  const extractorArgs = getYouTubeExtractorArgs();

  return [
    {
      name: 'cookies/clientes padrao',
      useCookies: true,
      extractorArgs,
    },
    {
      name: 'sem cookies/clientes padrao',
      useCookies: false,
      extractorArgs,
    },
  ];
};

const getYtDlpAuthFlags = (profile: YtDlpAuthProfile) => {
  const flags: Record<string, unknown> = {};
  if (profile.extractorArgs) {
    flags.extractorArgs = profile.extractorArgs;
  }

  const cookiesPath = getYtDlpCookiesPath();
  if (!profile.useCookies || !cookiesPath) {
    return flags;
  }

  if (!existsSync(cookiesPath)) {
    console.warn(`[YTDLP] YTDLP_COOKIES_PATH configurado, mas arquivo nao encontrado: ${cookiesPath}`);
    return flags;
  }

  flags.cookies = cookiesPath;
  return flags;
};

const getYtDlpCookiesPath = () => {
  const configuredPath = process.env.YTDLP_COOKIES_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  const inlineCookies = getInlineCookies();
  if (!inlineCookies) {
    return undefined;
  }

  const inlineCookiesPath =
    process.env.YTDLP_COOKIES_INLINE_PATH?.trim() || join(tmpdir(), 'youtube-cookies.txt');

  try {
    mkdirSync(dirname(inlineCookiesPath), { recursive: true });
    writeFileSync(inlineCookiesPath, inlineCookies, { mode: 0o600 });
    return inlineCookiesPath;
  } catch (error) {
    console.warn(
      `[YTDLP] Nao foi possivel gravar cookies inline em ${inlineCookiesPath}: ${(error as Error).message}`,
    );
    return undefined;
  }
};

const getInlineCookies = () => {
  const base64Cookies = process.env.YTDLP_COOKIES_BASE64?.trim();
  if (base64Cookies) {
    return Buffer.from(base64Cookies, 'base64').toString('utf8');
  }

  const cookiesContent = process.env.YTDLP_COOKIES_CONTENT?.trim();
  return cookiesContent ? cookiesContent.replace(/\\n/g, '\n') : undefined;
};

const isRequestedFormatUnavailableError = (error: unknown) => {
  return error instanceof Error && /Requested format is not available/i.test(error.message);
};

const shouldTryNextAuthProfile = (error: unknown, profile: YtDlpAuthProfile) => {
  return profile.useCookies && error instanceof Error && isYoutubeAuthError(error.message);
};

const isYoutubeAuthError = (message: string) => {
  return /sign in to confirm|not a bot|cookies-from-browser|use --cookies/i.test(message);
};

const getYouTubeExtractorArgs = () => {
  return process.env.YTDLP_EXTRACTOR_ARGS?.trim() || DEFAULT_YOUTUBE_EXTRACTOR_ARGS;
};

const getFormatFlags = (baseFlags: Record<string, unknown>, format: string | undefined) => {
  return format ? { ...baseFlags, format } : baseFlags;
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

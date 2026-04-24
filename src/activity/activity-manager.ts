import { DisTube, Queue } from "distube";
import { TextChannel, VoiceBasedChannel } from "discord.js";
import { getFavoriteSongs } from "../database/db";
import { shuffleSongs } from "../utils/queue";

interface GuildActivity {
  guildId: string;
  lastActivityTime: number;
  inactivityTimeout: NodeJS.Timeout | null;
  isMonitoring: boolean;
  voiceChannel?: VoiceBasedChannel;
  textChannel?: TextChannel;
}

interface ActivityManagerOptions {
  enableRadioMode?: (guildId: string) => void;
  isRadioModeActive?: (guildId: string) => boolean;
}

/**
 * Gerencia a atividade do bot em cada servidor.
 * Depois de um periodo de inatividade, inicia a radio com musicas favoritadas.
 */
export class ActivityManager {
  private distube: DisTube;
  private options: ActivityManagerOptions;
  private guildActivities: Map<string, GuildActivity> = new Map();
  private readonly INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutos
  private readonly CHECK_INTERVAL = 5 * 1000; // Verificar a cada 5 segundos

  constructor(distube: DisTube, options: ActivityManagerOptions = {}) {
    this.distube = distube;
    this.options = options;
  }

  public onPlaySong(queue: Queue): void {
    this.recordActivity(queue.id);
    console.log(
      `[Activity] Atividade registrada: musica tocando em ${queue.textChannel?.guild?.name}`,
    );
  }

  public onAddSong(queue: Queue): void {
    this.recordActivity(queue.id);
    console.log(
      `[Activity] Atividade registrada: musica adicionada em ${queue.textChannel?.guild?.name}`,
    );
  }

  public onAddList(queue: Queue): void {
    this.recordActivity(queue.id);
    console.log(
      `[Activity] Atividade registrada: playlist adicionada em ${queue.textChannel?.guild?.name}`,
    );
  }

  public onFinish(queue: Queue): void {
    this.startMonitoringInactivity(
      queue.id,
      queue.voiceChannel ?? undefined,
      queue.textChannel as TextChannel | undefined,
    );
    console.log(
      `[Activity] Monitorando inatividade em ${queue.textChannel?.guild?.name}`,
    );
  }

  public onDisconnect(queue: Queue): void {
    this.clearActivity(queue.id);
    console.log(
      `[Activity] Atividade limpa para ${queue.textChannel?.guild?.name}`,
    );
  }

  public recordActivity(guildId: string): void {
    const activity = this.guildActivities.get(guildId) || {
      guildId,
      lastActivityTime: Date.now(),
      inactivityTimeout: null,
      isMonitoring: false,
    };

    activity.lastActivityTime = Date.now();
    activity.isMonitoring = false;

    if (activity.inactivityTimeout) {
      clearInterval(activity.inactivityTimeout);
      activity.inactivityTimeout = null;
    }

    this.guildActivities.set(guildId, activity);
  }

  public startMonitoringInactivity(
    guildId: string,
    voiceChannel?: VoiceBasedChannel,
    textChannel?: TextChannel,
  ): void {
    let activity = this.guildActivities.get(guildId);

    if (!activity) {
      activity = {
        guildId,
        lastActivityTime: Date.now(),
        inactivityTimeout: null,
        isMonitoring: false,
        voiceChannel,
        textChannel,
      };
    }

    activity.voiceChannel = voiceChannel || activity.voiceChannel;
    activity.textChannel = textChannel || activity.textChannel;

    if (activity.isMonitoring) {
      return;
    }

    activity.isMonitoring = true;
    activity.lastActivityTime = Date.now();

    if (activity.inactivityTimeout) {
      clearInterval(activity.inactivityTimeout);
    }

    activity.inactivityTimeout = setInterval(() => {
      void this.checkAndStartRadio(guildId);
    }, this.CHECK_INTERVAL);

    this.guildActivities.set(guildId, activity);
    console.log(
      `[Activity] Iniciando monitoramento de inatividade para servidor ${guildId}`,
    );
  }

  private async checkAndStartRadio(guildId: string): Promise<void> {
    const activity = this.guildActivities.get(guildId);

    if (!activity || !activity.isMonitoring) {
      return;
    }

    const timeSinceLastActivity = Date.now() - activity.lastActivityTime;
    if (timeSinceLastActivity < this.INACTIVITY_TIMEOUT) {
      return;
    }

    if (this.options.isRadioModeActive?.(guildId)) {
      this.clearActivity(guildId);
      return;
    }

    if (!activity.voiceChannel || !activity.textChannel) {
      console.warn(
        `[Activity] Nao foi possivel iniciar radio por inatividade: canais nao encontrados para ${guildId}`,
      );
      this.clearActivity(guildId);
      return;
    }

    const favoriteSongs = shuffleSongs(getFavoriteSongs(guildId));
    if (favoriteSongs.length === 0) {
      console.warn(
        `[Activity] Nao foi possivel iniciar radio por inatividade: nenhum favorito em ${guildId}`,
      );
      this.clearActivity(guildId);
      return;
    }

    this.clearActivity(guildId);

    let loadedSongs = 0;
    for (const song of favoriteSongs) {
      try {
        await this.distube.play(activity.voiceChannel, song.url, {
          textChannel: activity.textChannel,
        });
        loadedSongs++;
      } catch (error) {
        console.error(
          `[Activity] Erro ao carregar favorito "${song.title}" na radio:`,
          error,
        );
      }
    }

    const radioQueue = this.distube.getQueue(guildId);
    radioQueue?.setRepeatMode(2);

    if (loadedSongs > 0) {
      this.options.enableRadioMode?.(guildId);
      console.log(
        `[Activity] Radio iniciada por inatividade com ${loadedSongs} musica(s) em ${activity.textChannel?.guild?.name}`,
      );
    } else {
      console.warn(
        `[Activity] Nenhuma musica favorita foi carregada para radio por inatividade em ${guildId}`,
      );
    }
  }

  public clearActivity(guildId: string): void {
    const activity = this.guildActivities.get(guildId);

    if (activity) {
      if (activity.inactivityTimeout) {
        clearInterval(activity.inactivityTimeout);
      }
      this.guildActivities.delete(guildId);
      console.log(`[Activity] Registros limpos para ${guildId}`);
    }
  }

  public getActivityStatus(guildId: string): {
    isActive: boolean;
    timeSinceLastActivity: number;
    isMonitoring: boolean;
  } | null {
    const activity = this.guildActivities.get(guildId);

    if (!activity) {
      return null;
    }

    return {
      isActive: !activity.isMonitoring,
      timeSinceLastActivity: Date.now() - activity.lastActivityTime,
      isMonitoring: activity.isMonitoring,
    };
  }

  public getInactivityTimeoutMs(): number {
    return this.INACTIVITY_TIMEOUT;
  }

  public forceDisconnect(guildId: string): void {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      try {
        queue.voice?.leave();
        console.log(
          `[Activity] Desconexao forcada em ${queue.textChannel?.guild?.name}`,
        );
      } catch (error) {
        console.warn(
          `[Activity] Erro ao desconectar forcadamente: ${(error as Error).message}`,
        );
      }
    }
    this.clearActivity(guildId);
  }

  public cleanup(): void {
    for (const [, activity] of this.guildActivities.entries()) {
      if (activity.inactivityTimeout) {
        clearInterval(activity.inactivityTimeout);
      }
    }
    this.guildActivities.clear();
    console.log(
      "[Activity] ActivityManager finalizado - todos os registros limpos",
    );
  }
}

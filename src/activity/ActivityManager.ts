import { DisTube } from "distube";

interface GuildActivity {
  guildId: string;
  lastActivityTime: number;
  inactivityTimeout: NodeJS.Timeout | null;
  isMonitoring: boolean;
}

/**
 * Gerencia a atividade do bot em cada servidor
 * Auto-desconecta do canal de voz após 2 minutos de inatividade
 */
export class ActivityManager {
  private distube: DisTube;
  private guildActivities: Map<string, GuildActivity> = new Map();
  private readonly INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 2 minutos em ms
  private readonly CHECK_INTERVAL = 5 * 1000; // Verificar a cada 5 segundos

  constructor(distube: DisTube) {
    this.distube = distube;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Atualizar atividade quando música começa a tocar
    (this.distube as any).on("playSong", (queue: any) => {
      this.recordActivity(queue.id!);
      console.log(
        `[Activity] Atividade registrada: música tocando em ${queue.textChannel?.guild?.name}`,
      );
    });

    // Atualizar atividade quando música é adicionada
    (this.distube as any).on("addSong", (queue: any) => {
      this.recordActivity(queue.id!);
      console.log(
        `[Activity] Atividade registrada: música adicionada em ${queue.textChannel?.guild?.name}`,
      );
    });

    // Atualizar atividade quando playlist é adicionada
    (this.distube as any).on("addList", (queue: any) => {
      this.recordActivity(queue.id!);
      console.log(
        `[Activity] Atividade registrada: playlist adicionada em ${queue.textChannel?.guild?.name}`,
      );
    });

    // Limpar atividade quando fila termina
    (this.distube as any).on("finish", (queue: any) => {
      this.startMonitoringInactivity(queue.id!);
      console.log(
        `[Activity] Monitorando inatividade em ${queue.textChannel?.guild?.name}`,
      );
    });

    // Limpar atividade quando a fila é parada manualmente
    (this.distube as any).on("stop", (queue: any) => {
      this.startMonitoringInactivity(queue.id!);
      console.log(
        `[Activity] Monitorando inatividade em ${queue.textChannel?.guild?.name} após parada manual`,
      );
    });

    // Limpar quando bot sai do servidor
    (this.distube as any).on("disconnect", (queue: any) => {
      this.clearActivity(queue.id!);
      console.log(
        `[Activity] Atividade limpa para ${queue.textChannel?.guild?.name}`,
      );
    });
  }

  /**
   * Registra uma atividade (música tocando/adicionada)
   */
  public recordActivity(guildId: string): void {
    const activity = this.guildActivities.get(guildId) || {
      guildId,
      lastActivityTime: Date.now(),
      inactivityTimeout: null,
      isMonitoring: false,
    };

    activity.lastActivityTime = Date.now();
    activity.isMonitoring = false;

    // Limpar timeout anterior se existir
    if (activity.inactivityTimeout) {
      clearInterval(activity.inactivityTimeout);
      activity.inactivityTimeout = null;
    }

    this.guildActivities.set(guildId, activity);
  }

  /**
   * Inicia monitoramento de inatividade para um servidor
   */
  public startMonitoringInactivity(guildId: string): void {
    let activity = this.guildActivities.get(guildId);

    if (!activity) {
      activity = {
        guildId,
        lastActivityTime: Date.now(),
        inactivityTimeout: null,
        isMonitoring: true,
      };
    }

    if (activity.isMonitoring) {
      return; // Já está monitorando
    }

    activity.isMonitoring = true;
    activity.lastActivityTime = Date.now();

    // Limpar timeout anterior se existir
    if (activity.inactivityTimeout) {
      clearInterval(activity.inactivityTimeout);
    }

    // Iniciar verificação periódica
    activity.inactivityTimeout = setInterval(() => {
      this.checkAndDisconnect(guildId);
    }, this.CHECK_INTERVAL);

    this.guildActivities.set(guildId, activity);
    console.log(
      `[Activity] Iniciando monitoramento de inatividade para servidor ${guildId}`,
    );
  }

  /**
   * Verifica se o tempo de inatividade foi excedido e desconecta se necessário
   */
  private checkAndDisconnect(guildId: string): void {
    const activity = this.guildActivities.get(guildId);

    if (!activity || !activity.isMonitoring) {
      return;
    }

    const timeSinceLastActivity = Date.now() - activity.lastActivityTime;

    // Se o tempo de inatividade foi excedido
    if (timeSinceLastActivity >= this.INACTIVITY_TIMEOUT) {
      const queue = this.distube.getQueue(guildId);

      if (queue) {
        try {
          queue.voice?.leave();
          console.log(
            `[Activity] Bot desconectado por inatividade em ${queue.textChannel?.guild?.name} (${Math.round(timeSinceLastActivity / 1000)}s sem atividade)`,
          );
          this.clearActivity(guildId);
        } catch (error) {
          console.warn(
            `[Activity] Erro ao desconectar por inatividade: ${(error as Error).message}`,
          );
        }
      } else {
        // Fila já não existe, limpar registro
        this.clearActivity(guildId);
        this.distube.voices.get(guildId)?.leave();
      }
    }
  }

  /**
   * Limpa registros de atividade para um servidor
   */
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

  /**
   * Obtém status de atividade de um servidor
   */
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

  /**
   * Força desconexão imediata de um servidor (para setup/cleanup)
   */
  public forceDisconnect(guildId: string): void {
    const queue = this.distube.getQueue(guildId);
    if (queue) {
      try {
        queue.voice?.leave();
        console.log(
          `[Activity] Desconexão forçada em ${queue.textChannel?.guild?.name}`,
        );
      } catch (error) {
        console.warn(
          `[Activity] Erro ao desconectar forçadamente: ${(error as Error).message}`,
        );
      }
    }
    this.clearActivity(guildId);
  }

  /**
   * Limpa todos os registros de atividade (útil no shutdown)
   */
  public cleanup(): void {
    for (const [guildId, activity] of this.guildActivities.entries()) {
      if (activity.inactivityTimeout) {
        clearInterval(activity.inactivityTimeout);
      }
    }
    this.guildActivities.clear();
    console.log(
      `[Activity] ActivityManager finalizado - todos os registros limpos`,
    );
  }
}

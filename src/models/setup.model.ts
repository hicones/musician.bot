export interface SetupStep {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface SetupResult {
  success: boolean;
  steps: SetupStep[];
  channelId?: string;
  messageId?: string;
}
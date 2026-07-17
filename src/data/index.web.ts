export type TakaiDatabase = {
  __platform: 'web-preview';
  closedCase: boolean;
  demoSprayCount: number;
};

export const initializeTakaiDatabase = async (): Promise<TakaiDatabase> => ({
  __platform: 'web-preview',
  closedCase: false,
  demoSprayCount: 0,
});

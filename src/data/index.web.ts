export type TakaiDatabase = {
  __platform: 'web-preview';
  demoSprayCount: number;
};

export const initializeTakaiDatabase = async (): Promise<TakaiDatabase> => ({
  __platform: 'web-preview',
  demoSprayCount: 0,
});

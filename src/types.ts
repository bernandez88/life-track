export type AppBindings = {
  DB: D1Database;
  BACKUPS: R2Bucket;
};

export type AppVariables = {
  userId: string;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

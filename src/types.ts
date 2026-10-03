export type AppBindings = {
  DB: D1Database;
};

export type AppVariables = {
  userId: string;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

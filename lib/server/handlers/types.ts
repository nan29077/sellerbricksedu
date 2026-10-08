import type { SessionUser } from '../auth';

export type Ctx = {
  req: Request;
  body: any;
  user: SessionUser | null;
  settings: Record<string, string>;
};
export type AuthedCtx = Ctx & { user: SessionUser };
export type Handler = (ctx: Ctx) => Promise<Response>;

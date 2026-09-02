import { type Request, type Response, type NextFunction } from "express";
import {
  clearSession,
  getSessionId,
  getSession,
  loadUserById,
  toAuthUser,
  updateSession,
  type AuthUser,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
      sessionId?: string | undefined;
    }

    export interface AuthedRequest {
      user: User;
      sessionId: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Refresh the user profile from the source of truth on every request
  // so that role / permission changes take effect immediately and
  // deleted users are rejected. Cheap because it is a single primary-key
  // lookup; revisit with a short TTL cache if it shows up in a profile.
  const user = await loadUserById(session.user.id);
  if (!user) {
    await clearSession(res, sid);
    next();
    return;
  }

  const fresh = toAuthUser(user);
  // Only persist the session when the cached projection diverges from
  // the latest user record, to avoid a write per request.
  if (JSON.stringify(fresh) !== JSON.stringify(session.user)) {
    await updateSession(sid, { ...session, user: fresh });
  }

  req.user = fresh;
  req.sessionId = sid;
  next();
}

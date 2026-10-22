import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncFn = (req: Request, res: Response) => Promise<void>;

export function asyncMiddleware(fn: AsyncFn): RequestHandler {
  return (req, res, next: NextFunction): void => {
    void fn(req, res).then(
      () => {
        next();
      },
      (error: unknown) => {
        next(error);
      },
    );
  };
}

export function asyncRoute(fn: AsyncFn): RequestHandler {
  return (req, res, next: NextFunction): void => {
    void fn(req, res).then(
      () => undefined,
      (error: unknown) => {
        next(error);
      },
    );
  };
}

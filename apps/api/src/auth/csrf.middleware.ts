import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireTrustedOrigin(allowedOrigin: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(request.method) || request.get('origin') === allowedOrigin) {
      next();
      return;
    }
    response.status(403).json({ message: 'Invalid request origin' });
  };
}

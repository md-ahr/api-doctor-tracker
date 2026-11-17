import type { Response } from "express";

export function pageMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function sendData(res: Response, status: number, message: string, data: unknown): void {
  res.status(status).json({ success: true, message, data });
}

export function sendList(res: Response, message: string, data: unknown[], meta: unknown): void {
  res.status(200).json({ success: true, message, data, meta });
}

export function sendFailure(
  res: Response,
  status: number,
  message: string,
  code: string,
  details: { path: string; message: string }[] = [],
  data: unknown = null,
): void {
  res.status(status).json({
    success: false,
    message,
    data,
    error: { code, details },
  });
}

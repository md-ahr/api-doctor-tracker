import type { Request, Response } from "express";

import { sendData } from "../lib/response.js";
import type { DashboardQuery } from "../schemas/dashboard.schema.js";
import * as dashboardService from "../services/dashboard.service.js";

export async function get(_req: Request, res: Response): Promise<void> {
  const query = (res.locals.query ?? {}) as DashboardQuery;
  const dashboard = await dashboardService.getDashboard(query);
  sendData(res, 200, "Dashboard retrieved successfully", dashboard);
}

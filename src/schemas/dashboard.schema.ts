import { z } from "zod";

export const dashboardQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

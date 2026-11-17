import { Router } from "express";
import { serve, setup } from "swagger-ui-express";

import { openApiDocument } from "./openapi.js";

export const swaggerRouter = Router();
const document = openApiDocument();

swaggerRouter.get("/openapi.json", (_req, res) => {
  res.json(document);
});

swaggerRouter.use(serve);
swaggerRouter.get("/", setup(document));

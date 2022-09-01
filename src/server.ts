import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler, routeNotFoundHandler } from "./middlewares/errorHandler";
import settings from "./settings";
import { logger } from "./utils/logger";
import { requestLogger } from "./middlewares/requestLogger";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.raw({ limit: "1mb" }));
app.use(requestLogger);

routes(app);

app.use(routeNotFoundHandler);
app.use(errorHandler);

const { PORT } = settings;

app.listen(PORT, async () => {
  logger.info(`Server started on port ${PORT}`);
});

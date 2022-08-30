import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler, routeNotFoundHandler } from "./middlewares/errorHandler";
import settings from "./settings";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.raw({ limit: "1mb" }));
app.use((request: Request, _response: Response, next: NextFunction) => {
  console.log(`A ${request.method} request has been received`);
  next();
});

routes(app);

app.use(routeNotFoundHandler);
app.use(errorHandler);

const { PORT } = settings;

app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);
});

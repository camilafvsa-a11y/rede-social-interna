import express, { type Express } from "express";
import cors from "cors";
import { join } from "path";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const uploadsDir = join(process.cwd(), "uploads");
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

export default app;

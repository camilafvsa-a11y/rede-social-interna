import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import channelsRouter from "./channels.js";
import postsRouter from "./posts.js";
import ticketsRouter from "./tickets.js";
import birthdaysRouter from "./birthdays.js";
import termsRouter from "./terms.js";
import docsRouter from "./docs.js";
import exportRouter from "./export.js";
import notificationsRouter from "./notifications.js";
import integraItemsRouter from "./integra-items.js";
import workTagsRouter from "./work-tags.js";
import dmsRouter from "./dms.js";
import uploadRouter from "./upload.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/channels", channelsRouter);
router.use("/posts", postsRouter);
router.use("/tickets", ticketsRouter);
router.use("/birthdays", birthdaysRouter);
router.use("/terms", termsRouter);
router.use("/docs", docsRouter);
router.use("/data", exportRouter);
router.use("/notifications", notificationsRouter);
router.use("/integra-items", integraItemsRouter);
router.use("/work-tags", workTagsRouter);
router.use("/dms", dmsRouter);
router.use("/upload", uploadRouter);

export default router;

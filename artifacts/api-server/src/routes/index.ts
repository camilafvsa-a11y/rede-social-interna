import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import channelsRouter from "./channels.js";
import postsRouter from "./posts.js";
import ticketsRouter from "./tickets.js";
import birthdaysRouter from "./birthdays.js";
import termsRouter from "./terms.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/channels", channelsRouter);
router.use("/posts", postsRouter);
router.use("/tickets", ticketsRouter);
router.use("/birthdays", birthdaysRouter);
router.use("/terms", termsRouter);

export default router;

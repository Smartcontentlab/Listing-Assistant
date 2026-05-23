import { Router, type IRouter } from "express";
import healthRouter from "./health";
import listingsRouter from "./listings";
import soldPricesRouter from "./sold-prices";
import platformsRouter from "./platforms";
import aiRouter from "./ai";
import imagesRouter from "./images";

const router: IRouter = Router();

router.use(healthRouter);
router.use(listingsRouter);
router.use(soldPricesRouter);
router.use(platformsRouter);
router.use(aiRouter);
router.use(imagesRouter);

export default router;

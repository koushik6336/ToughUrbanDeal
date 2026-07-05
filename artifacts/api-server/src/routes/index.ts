import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import orgsRouter from "./orgs";
import projectsRouter from "./projects";
import queuesRouter from "./queues";
import jobsRouter from "./jobs";
import scheduledJobsRouter from "./scheduledJobs";
import workersRouter from "./workers";
import dlqRouter from "./dlq";
import metricsRouter from "./metrics";
import retryPoliciesRouter from "./retryPolicies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(orgsRouter);
router.use(projectsRouter);
router.use(queuesRouter);
router.use(jobsRouter);
router.use(scheduledJobsRouter);
router.use(workersRouter);
router.use(dlqRouter);
router.use(metricsRouter);
router.use(retryPoliciesRouter);

export default router;

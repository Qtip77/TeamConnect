import { getAuth } from "@/lib/auth";

import honoFactory from "./hono-factory";
import { corsMiddleware } from "./middlewares/cors-middleware";
import { csrfMiddleware } from "./middlewares/csrf-middleware";
import { sessionMiddleware } from "./middlewares/session-middleware";
import trucksRoute from "./routes/trucks-routes";
import timesheetsRoute from "./routes/timesheet-routes";

const routes = honoFactory
  .createApp()
  .basePath("/api")
  .use(corsMiddleware)
  .use(csrfMiddleware)
  .use(sessionMiddleware)
  .on(["POST", "GET"], "/auth/*", (c) => {
    return getAuth(c).handler(c.req.raw);
  })
  .route("/trucks", trucksRoute)
  .route("/timesheets", timesheetsRoute);

export type HonoApp = typeof routes;
export default routes;

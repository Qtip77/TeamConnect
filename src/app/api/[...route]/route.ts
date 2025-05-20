import { handle } from "hono/vercel";


import routes from "@/server";

export const runtime = "edge";

export const GET = handle(routes);
export const POST = handle(routes);
export const PATCH = handle(routes);
export const DELETE = handle(routes);
export const OPTIONS = handle(routes);
export const PUT = handle(routes);
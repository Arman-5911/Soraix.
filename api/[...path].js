import { apiHandler } from "../server/api.mjs";
export default async function handler(req, res) {
  if (!(await apiHandler(req, res))) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "API route not found." }));
  }
}

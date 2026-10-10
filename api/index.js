import { apiHandler } from "../server/api.mjs";

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return apiHandler(req, res);
  }
  if (url.pathname === "/api/index" || url.pathname === "/api") {
    const route = url.searchParams.get("route") || "health";
    url.searchParams.delete("route");
    url.pathname = `/api/${route.replace(/^\/+/, "")}`;
    req.url = url.pathname + url.search;
  }
  await apiHandler(req, res);
}

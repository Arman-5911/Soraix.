import { ApiError } from "./anilist.mjs";

export function dubUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("Invalid media URL.", 400);
  }
  if (
    url.protocol !== "https:" ||
    !(
      /^[a-z0-9-]+\.vmeas\.cloud$/.test(url.hostname) ||
      url.hostname === "prx-vi-a-1.vmpx.online"
    ) ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/hls2\/[a-zA-Z0-9/_-]+\.(m3u8|ts|m4s|mp4|key)$/.test(url.pathname)
  )
    throw new ApiError("Unsupported media URL.", 400);
  return url;
}
export function deliveryUrl(value) {
  return (
    "/api/dub-media?token=" +
    Buffer.from(dubUrl(value).href).toString("base64url")
  );
}
export function rewriteManifest(text, base) {
  if (!text.trimStart().startsWith("#EXTM3U"))
    throw new ApiError("Invalid stream manifest.", 502);
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      if (!line.startsWith("#"))
        return deliveryUrl(new URL(line.trim(), base).href);
      return line.replace(
        /URI="([^"]+)"/g,
        (_, uri) => `URI="${deliveryUrl(new URL(uri, base).href)}"`,
      );
    })
    .join("\n");
}
export async function deliverDub(token) {
  if (!token || token.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(token))
    throw new ApiError("Invalid media token.", 400);
  const url = dubUrl(Buffer.from(token, "base64url").toString("utf8"));
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new ApiError(
      "The dub source rejected playback. Refresh the episode to retry.",
      502,
    );
  if (!url.pathname.endsWith(".m3u8")) {
    if (/text\/html/i.test(response.headers.get("content-type") || ""))
      throw new ApiError("Invalid media response.", 502);
    const stream = (async function* () {
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 32 * 1024 * 1024)
          throw new ApiError("Media segment exceeds the delivery limit.", 413);
        yield chunk;
      }
    })();
    return {
      stream,
      type: url.pathname.endsWith(".ts")
        ? "video/mp2t"
        : "application/octet-stream",
    };
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024)
      throw new ApiError("Media segment exceeds the delivery limit.", 413);
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  if (url.pathname.endsWith(".m3u8"))
    return {
      data: rewriteManifest(data.toString("utf8"), url),
      type: "application/vnd.apple.mpegurl",
    };
  if (/text\/html/i.test(response.headers.get("content-type") || ""))
    throw new ApiError("Invalid media response.", 502);
  return {
    data,
    type: url.pathname.endsWith(".ts")
      ? "video/mp2t"
      : "application/octet-stream",
  };
}

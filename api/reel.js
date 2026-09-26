import { Readable } from "node:stream";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

function decodeInstagramUrl(value = "") {
  let out=value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0025/gi, "%")
    .replace(/&amp;/g, "&");

  // Instagram embed payloads can contain more than one escaped slash layer.
  for(let i=0;i<4;i++) out=out.replace(/\\\//g, "/");
  return out;
}

function findVideoUrl(html) {
  const patterns = [
    /"video_url"\s*:\s*"([^"]+)"/i,
    /"video_versions"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url)?["']/i,
    /(https:[^"'\s]+(?:cdninstagram|fbcdn)[^"'\s]+\.mp4[^"'\s]*)/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeInstagramUrl(match[1]);
  }
  return "";
}

async function resolveVideo(code) {
  const stamp=Date.now();
  const paths = [
    `https://www.instagram.com/p/${code}/embed/captioned/?v=${stamp}`,
    `https://www.instagram.com/p/${code}/embed/?v=${stamp}`,
    `https://www.instagram.com/reel/${code}/embed/captioned/?v=${stamp}`,
    `https://www.instagram.com/reel/${code}/embed/?v=${stamp}`
  ];

  for (const url of paths) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UA,
          "accept-language": "pt-PT,pt;q=0.9,en;q=0.7",
          accept: "text/html,application/xhtml+xml",
          "cache-control":"no-cache",
          pragma:"no-cache"
        },
        redirect: "follow",
        cache:"no-store"
      });
      if (!response.ok) continue;
      const html = await response.text();
      const video = findVideoUrl(html);
      if (video) return video;
    } catch {}
  }
  return "";
}

async function streamVideo(req, res, videoUrl) {
  const range = req.headers?.range;
  const headers = {
    "user-agent": UA,
    accept: "video/mp4,video/*;q=0.9,*/*;q=0.5",
    referer: "https://www.instagram.com/"
  };
  if (range) headers.range = range;

  const upstream = await fetch(videoUrl, {
    method: "GET",
    headers,
    redirect: "follow",
    cache:"no-store"
  });

  if (!(upstream.ok || upstream.status === 206)) {
    throw new Error(`instagram_media_${upstream.status}`);
  }

  const contentType = upstream.headers.get("content-type") || "video/mp4";
  if (!/^(video\/|application\/octet-stream)/i.test(contentType)) {
    throw new Error("instagram_media_invalid_type");
  }

  res.statusCode = upstream.status === 206 ? 206 : 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Vary", "Range");

  for (const name of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  if (!upstream.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", "bytes");

  if (!upstream.body) {
    res.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", reject);
    res.on("finish", resolve);
    res.on("close", resolve);
    stream.pipe(res);
  });
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const code = String(req.query?.code || "").trim();
  if (!/^[A-Za-z0-9_-]{5,32}$/.test(code)) {
    res.status(400).json({ error: "invalid_video" });
    return;
  }

  const videoUrl = await resolveVideo(code);
  if (!videoUrl) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({ error: "video_unavailable" });
    return;
  }

  try {
    await streamVideo(req, res, videoUrl);
  } catch {
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store");
      res.status(502).json({ error: "video_proxy_unavailable" });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

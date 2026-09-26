const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

function decodeInstagramUrl(value = "") {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0025/gi, "%")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
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
  const stamp = Date.now();
  const paths = [
    `https://www.instagram.com/reel/${code}/embed/captioned/?v=${stamp}`,
    `https://www.instagram.com/reel/${code}/embed/?v=${stamp}`,
    `https://www.instagram.com/p/${code}/embed/captioned/?v=${stamp}`,
    `https://www.instagram.com/p/${code}/embed/?v=${stamp}`
  ];

  for (const url of paths) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UA,
          "accept-language": "pt-PT,pt;q=0.9,en;q=0.7",
          accept: "text/html,application/xhtml+xml",
          "cache-control": "no-cache",
          pragma: "no-cache"
        },
        redirect: "follow",
        cache: "no-store"
      });

      if (!response.ok) continue;
      const html = await response.text();
      const video = findVideoUrl(html);
      if (video) return video;
    } catch {}
  }
  return "";
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

  // Instagram media URLs are signed and short-lived. Never cache the redirect.
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const videoUrl = await resolveVideo(code);
  if (!videoUrl) {
    res.status(404).json({ error: "video_unavailable" });
    return;
  }

  res.setHeader("Location", videoUrl);
  res.status(302).end();
}

import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { LandingContent, landingPaths, genreNames, genrePath, landingTitle } from "../src/landingContent.js";
import { pageDescription } from "../src/pageMetadata.js";
const template = await fs.readFile("dist/index.html", "utf8");
await fs.writeFile("dist/spa.html", template);
const base = new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://soraix.vercel.app")).origin;
const escape = s => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const paths = [...landingPaths, ...genreNames.map(genrePath)];
for (const route of paths) {
  const url = new URL(route, base).href;
  const schema = JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": base + "/#website", name: "SoraiX", url: base + "/" },
    { "@type": "Organization", "@id": base + "/#organization", name: "SoraiX", url: base + "/" },
  ] }).replaceAll("<", "\\u003c");
  const html = template.replace(/<title>.*?<\/title>/s, `<title>${escape(landingTitle(route))}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/, `$1${escape(pageDescription(route))}$2`)
    .replace("</head>", `<link rel="canonical" href="${escape(url)}"><script type="application/ld+json" id="website-schema">${schema}</script></head>`)
    .replace('<div id="site-overview"></div>', `<div id="site-overview">${renderToString(React.createElement(LandingContent, { pathname: route }))}</div>`);
  const directory = path.join("dist", route.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}
await fs.writeFile("dist/llms.txt", `# SoraiX\n\nAnime and comics discovery with live provider-dependent playback and reading. No account required.\n\n## Key pages\n${landingPaths.map(p => `- [${landingTitle(p)}](${new URL(p, base).href})`).join("\n")}\n\nCatalogue listings do not guarantee available episodes or chapters.\n`);
console.log(`Prerendered ${paths.length} public landing overviews with metadata; live catalogue stays client-rendered.`);

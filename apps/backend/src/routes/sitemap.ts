import type { FastifyInstance } from "fastify";
import { getAllPostsForSitemap } from "../services/sitemap.service.js";

const SITE_URL = "https://vmetke.ru";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function sitemapRoutes(app: FastifyInstance) {
  app.get("/sitemap.xml", async (request, reply) => {
    const posts = await getAllPostsForSitemap();

    const urls = [
      `<url><loc>${escapeXml(SITE_URL + "/")}</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
      ...posts.map(
        (post) =>
          `<url><loc>${escapeXml(`${SITE_URL}/post/${post.id}`)}</loc><lastmod>${post.createdAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
      ),
    ].join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

    reply.header("Content-Type", "application/xml; charset=utf-8");
    return xml;
  });
}
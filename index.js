const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = "https://cinesubz.lk";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchPage(url) {
    try {
        const response = await axios.get(url, {
            headers: { "User-Agent": USER_AGENT },
            timeout: 30000,
            maxRedirects: 15
        });
        return { $: cheerio.load(response.data), finalUrl: response.request.res.responseUrl || url };
    } catch (e) {
        console.error(`Fetch Error: ${url}`);
        return null;
    }
}

function parseListItem($, el) {
    const $el = $(el);
    const link = $el.find("a").first().attr("href") || "";
    return {
        title: $el.find("h3").text().trim() || $el.find(".item-desc-title h3").text().trim(),
        slug: link.split("/").filter(Boolean).pop() || "",
        url: link.startsWith("http") ? link : BASE_URL + link,
        poster: $el.find("img").attr("src") || $el.find("img").attr("data-original") || "",
        imdb: $el.find(".imdb-score").text().trim(),
        quality: $el.find(".badge-quality-corner").text().trim(),
        type: link.includes("/tvshows/") ? "tv" : "movie"
    };
}

// Root
app.get("/", (req, res) => {
    res.json({ success: true, message: "CineSubz API Running" });
});

// Search, Trending, etc. (same as before)
app.get("/api/search", async (req, res) => { /* ... keep previous */ });
app.get("/api/trending", async (req, res) => { /* ... keep previous */ });
app.get("/api/movies", async (req, res) => { /* ... keep previous */ });
app.get("/api/tvshows", async (req, res) => { /* ... keep previous */ });

// ==================== IMPROVED DETAILS ====================
app.get("/api/details", async (req, res) => {
    let { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, error: "slug required" });

    try {
        const url = slug.startsWith("http") ? slug : `${BASE_URL}/${slug.replace(/^\/+/, '')}`;
        const page = await fetchPage(url);
        if (!page) throw new Error("Page load failed");

        const { $ } = page;

        const title = $("h1").first().text().trim() || $(".entry-title").text().trim();
        const description = $(".details-desc, .entry-content").text().trim().substring(0, 800);
        const poster = $(".thumb, img.wp-post-image").first().attr("src");
        const imdb = $(".imdb-score").text().trim();

        const cast = [];
        $("a[href*='/cast/']").each((_, el) => cast.push($(el).text().trim()));

        const downloads = [];

        // Extract all possible download links
        $("a[href*='zt-links'], a[href*='download'], .movie-download-button, .links-table a").each((_, el) => {
            let href = $(el).attr("href");
            const text = $(el).text().trim();
            if (href) {
                if (!href.startsWith("http")) href = BASE_URL + href;
                downloads.push({
                    name: text || "Download",
                    url: href,
                    quality: $(el).closest("tr, div").find(".badge-quality-corner").text().trim() || ""
                });
            }
        });

        const uniqueDownloads = Array.from(new Map(downloads.map(item => [item.url, item])).values());

        res.json({
            success: true,
            data: {
                title,
                url,
                poster: poster ? (poster.startsWith("http") ? poster : BASE_URL + poster) : "",
                imdb: imdb || null,
                description: description || "No description",
                cast: [...new Set(cast)].slice(0, 12),
                downloads: uniqueDownloads,
                note: "Click the buttons below. Some may open zt-links page - click 'Get Link' there."
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

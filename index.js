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
        const { data } = await axios.get(url, {
            headers: { "User-Agent": USER_AGENT },
            timeout: 25000,
            maxRedirects: 5
        });
        return cheerio.load(data);
    } catch (e) {
        console.error(`❌ Fetch Error: ${url}`);
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

// ==================== ROOT ENDPOINT ====================
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "🎬 CineSubz.lk Full Public API is Running",
        developer: "Sinhala Subtitle Movies & TV Shows",
        endpoints: {
            home: "http://localhost:3000/",
            trending: "/api/trending",
            movies: "/api/movies",
            tvshows: "/api/tvshows",
            search: "/api/search?q=avatar",
            details: "/api/details?slug=avatar-fire-and-ash-2025-sinhala-subtitles"
        }
    });
});

// Trending
app.get("/api/trending", async (req, res) => {
    try {
        const $ = await fetchPage(BASE_URL);
        const items = [];
        $(".trending .module-item").each((_, el) => items.push(parseListItem($, el)));
        res.json({ success: true, count: items.length, data: items });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Movies with Pagination
app.get("/api/movies", async (req, res) => {
    const page = req.query.page || 1;
    try {
        const $ = await fetchPage(`${BASE_URL}/movies/page/${page}/`);
        const items = [];
        $(".display-item").each((_, el) => items.push(parseListItem($, el)));
        res.json({ success: true, page: parseInt(page), count: items.length, data: items });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// TV Shows
app.get("/api/tvshows", async (req, res) => {
    const page = req.query.page || 1;
    try {
        const $ = await fetchPage(`${BASE_URL}/tvshows/page/${page}/`);
        const items = [];
        $(".display-item").each((_, el) => items.push(parseListItem($, el)));
        res.json({ success: true, page: parseInt(page), count: items.length, data: items });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Search
app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, error: "q අවශ්‍යයි" });

    try {
        const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(q)}`);
        const items = [];
        $(".display-item").each((_, el) => items.push(parseListItem($, el)));
        res.json({ success: true, query: q, count: items.length, data: items });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Full Details with Episodes & Downloads
app.get("/api/details", async (req, res) => {
    let { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, error: "slug අවශ්‍යයි" });

    try {
        const url = slug.startsWith("http") ? slug : `${BASE_URL}/${slug.replace(/^\/+/, '')}`;
        const $ = await fetchPage(url);
        if (!$) throw new Error("Cannot load page");

        const title = $("h1").first().text().trim() || $(".entry-title").text().trim();
        const description = $(".details-desc, .entry-content").text().trim().substring(0, 1000);
        const poster = $(".thumb, img").first().attr("src");
        const imdb = $(".imdb-score").text().trim();

        // Cast
        const cast = [];
        $("a[href*='/cast/']").each((_, el) => cast.push($(el).text().trim()));

        // Downloads
        const downloads = [];
        $("a[href*='download'], a[href*='zt-links'], .links-table a").each((_, el) => {
            let href = $(el).attr("href");
            if (href) {
                if (!href.startsWith("http")) href = BASE_URL + href;
                downloads.push({
                    name: $(el).text().trim() || "Download",
                    url: href,
                    quality: $(el).closest("tr, div").find(".badge-quality-corner").text().trim() || ""
                });
            }
        });

        // Episodes for TV Shows
        const episodes = [];
        if (url.includes("/tvshows/")) {
            $(".episodes-list li a, .episode-link").each((_, el) => {
                const epTitle = $(el).text().trim();
                let epUrl = $(el).attr("href");
                if (epTitle && epUrl) {
                    if (!epUrl.startsWith("http")) epUrl = BASE_URL + epUrl;
                    episodes.push({ episode: epTitle, url: epUrl });
                }
            });
        }

        res.json({
            success: true,
            data: {
                title,
                type: url.includes("/tvshows/") ? "tv" : "movie",
                url,
                poster: poster ? (poster.startsWith("http") ? poster : BASE_URL + poster) : "",
                imdb: imdb || null,
                description: description || "විස්තර නොමැත",
                cast: [...new Set(cast)].slice(0, 12),
                downloads,
                episodes: episodes.length ? episodes : null
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log("🎬 CineSubz.lk Full API Server Started Successfully!");
    console.log("=".repeat(60));
    console.log(`🌐 Root Endpoint     : http://localhost:${PORT}`);
    console.log(`📺 Trending          : http://localhost:${PORT}/api/trending`);
    console.log(`🎥 Movies            : http://localhost:${PORT}/api/movies`);
    console.log(`📺 TV Shows          : http://localhost:${PORT}/api/tvshows`);
    console.log(`🔍 Search            : http://localhost:${PORT}/api/search?q=avatar`);
    console.log(`📋 Full Details      : http://localhost:${PORT}/api/details?slug=game-of-thrones-2011-sinhala-subtitles`);
    console.log("=".repeat(60));
    console.log("✅ Ready to use! Open browser and test the links.\n");
});

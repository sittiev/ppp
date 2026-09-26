(() => {
    var SAMPLE_STEP = 10;
    var BUCKET_SHIFT = 6;
    var TOP_BUCKETS = 5;
    var MIN_SATURATION = 8;
    var MIN_LIGHT_BUCKETS = 2;
    var MIN_LIGHTNESS = (40 / 255) * 100;
    var RETRY_DELAYS = [0, 500, 1000];

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function dominantVibrant(image) {
        var width = image.naturalWidth;
        var height = image.naturalHeight;
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, width, height);
        var pixels = ctx.getImageData(0, 0, width, height).data;
        var levels = 8 - BUCKET_SHIFT;
        var buckets = {};
        for (var i = 0; i < pixels.length; i += 4 * SAMPLE_STEP) {
            if (pixels[i + 3] < 125) continue;
            var r = pixels[i],
                g = pixels[i + 1],
                b = pixels[i + 2];
            if (r > 250 && g > 250 && b > 250) continue;
            var key =
                ((r >> BUCKET_SHIFT) << (2 * levels)) |
                ((g >> BUCKET_SHIFT) << levels) |
                (b >> BUCKET_SHIFT);
            var bucket = buckets[key];
            if (!bucket) bucket = buckets[key] = [0, 0, 0, 0];
            bucket[0] += 1;
            bucket[1] += r;
            bucket[2] += g;
            bucket[3] += b;
        }
        var top = Object.keys(buckets)
            .map((key) => buckets[key])
            .sort((a, b) => b[0] - a[0])
            .slice(0, TOP_BUCKETS);
        if (top.length < 2) return null;
        var vibrant = null;
        var lightCount = 0;
        for (var j = 0; j < top.length; j++) {
            var candidate = new Color("srgb", [
                top[j][1] / top[j][0] / 255,
                top[j][2] / top[j][0] / 255,
                top[j][3] / top[j][0] / 255,
            ]).to("hsl");
            if (candidate.coords[2] >= MIN_LIGHTNESS) lightCount += 1;
            if (!vibrant || candidate.coords[1] > vibrant.coords[1]) {
                vibrant = candidate;
            }
        }
        if (lightCount < MIN_LIGHT_BUCKETS) return null;
        return vibrant;
    }

    function applyWindowColor(vibrant) {
        if (!(vibrant.coords[1] >= MIN_SATURATION)) return;
        var aero = new Color("hsl", [
            vibrant.coords[0],
            clamp(vibrant.coords[1], 25, 60),
            clamp(vibrant.coords[2], 42, 58),
        ]);
        document.documentElement.style.setProperty(
            "--window-accent",
            aero.to("srgb").toString({ format: "rgb" }),
        );
    }

    function applyAccent(image, attempt) {
        if (typeof Color === "undefined") return;
        try {
            if (!image.complete || image.naturalWidth === 0) {
                retry(image, attempt);
                return;
            }
            var vibrant = dominantVibrant(image);
            if (!vibrant) {
                retry(image, attempt);
                return;
            }
            applyWindowColor(vibrant);
        } catch (error) {
            console.warn("background from avatar failed", {
                error: error.message,
            });
        }
    }

    function retry(image, attempt) {
        if (attempt >= RETRY_DELAYS.length) return;
        setTimeout(() => {
            applyAccent(image, attempt + 1);
        }, RETRY_DELAYS[attempt]);
    }

    function loadAvatarImage(userId, hash) {
        var ext = hash.startsWith("a_") ? "gif" : "png";
        var image = new Image();
        image.crossOrigin = "anonymous";
        image.addEventListener("load", () => {
            applyAccent(image, 0);
        });
        image.src = `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=256`;
    }

    function init() {
        fetch("/api/discord-user")
            .then((res) => res.json())
            .then((data) => {
                if (!data.userId) return;
                return fetch(`https://api.lanyard.rest/v1/users/${data.userId}`)
                    .then((res) => res.json())
                    .then((lanyard) => {
                        if (!lanyard.success) return;
                        loadAvatarImage(
                            data.userId,
                            lanyard.data.discord_user.avatar,
                        );
                    });
            })
            .catch(() => {});
    }

    init();
})();

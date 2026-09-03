(function () {
    "use strict";

    var avatarEl = document.getElementById("discord-avatar");
    var DISCORD_USER_ID = null;
    var PLACEHOLDER = "assets/images/avatar.png";

    avatarEl.crossOrigin = "anonymous";
    avatarEl.addEventListener("load", function () {
        applyAvatarBackground(0);
    });

    function luminance(rgb) {
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }

    function toCssColor(rgb) {
        return "rgb(" + rgb.join(",") + ")";
    }

    function toHsl(rgb) {
        var r = rgb[0] / 255,
            g = rgb[1] / 255,
            b = rgb[2] / 255;
        var max = Math.max(r, g, b),
            min = Math.min(r, g, b);
        var l = (max + min) / 2,
            h = 0,
            s = 0;
        if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }

    function toRgb(hsl) {
        function channel(n) {
            var k = (n + hsl[0] * 12) % 12;
            var a = hsl[1] * Math.min(hsl[2], 1 - hsl[2]);
            return Math.round(
                255 * (hsl[2] - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
            );
        }
        return [channel(0), channel(8), channel(4)];
    }

    function aeroWindowColor(rgb) {
        var hsl = toHsl(rgb);
        if (hsl[1] < 0.08) return null;
        return toRgb([
            hsl[0],
            Math.min(Math.max(hsl[1], 0.25), 0.6),
            Math.min(Math.max(hsl[2], 0.42), 0.58),
        ]);
    }

    function applyWindowColor(palette) {
        var cardWindow = document.querySelector(".card-window");
        if (!cardWindow) return;
        var vibrant = null;
        for (var i = 0; i < palette.length; i++) {
            var s = toHsl(palette[i])[1];
            if (!vibrant || s > toHsl(vibrant)[1]) vibrant = palette[i];
        }
        if (toHsl(vibrant)[1] < 0.08) return;
        var aeroColor = aeroWindowColor(vibrant);
        if (!aeroColor) return;
        cardWindow.style.setProperty("--w7-w-bg", toCssColor(aeroColor));
    }

    function applyAvatarBackground(attempt) {
        if (typeof ColorThief === "undefined") return;
        try {
            var palette = new ColorThief().getPalette(avatarEl, 5);
            if ((!palette || palette.length < 2) && attempt < 3) {
                setTimeout(function () {
                    applyAvatarBackground(attempt + 1);
                }, 500);
                return;
            }
            if (!palette || palette.length < 2) return;
            var byLuminance = palette.slice().sort(function (a, b) {
                return luminance(b) - luminance(a);
            });
            var lightColors = byLuminance.filter(function (rgb) {
                return luminance(rgb) >= 40;
            });
            if (lightColors.length < 2) return;
            applyWindowColor(palette);
        } catch (error) {
            console.warn("background from avatar failed", {
                error: error.message,
            });
        }
    }

    function setPlaceholder() {
        avatarEl.src = PLACEHOLDER;
        avatarEl.onerror = null;
    }

    function setAvatar(url) {
        avatarEl.onerror = setPlaceholder;
        avatarEl.src = url;
    }

    function loadAvatar() {
        if (!DISCORD_USER_ID) {
            setPlaceholder();
            return;
        }

        fetch("https://api.lanyard.rest/v1/users/" + DISCORD_USER_ID)
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                if (data.success && data.data.discord_user.avatar) {
                    var id = DISCORD_USER_ID;
                    var hash = data.data.discord_user.avatar;
                    var ext = hash.startsWith("a_") ? "gif" : "png";
                    setAvatar(
                        "https://cdn.discordapp.com/avatars/" +
                            id +
                            "/" +
                            hash +
                            "." +
                            ext +
                            "?size=256",
                    );
                } else {
                    setPlaceholder();
                }
            })
            .catch(setPlaceholder);
    }

    function init() {
        fetch("/api/discord-user")
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                if (data.userId) {
                    DISCORD_USER_ID = data.userId;
                    loadAvatar();
                    setInterval(loadAvatar, 300000);
                } else {
                    setPlaceholder();
                }
            })
            .catch(setPlaceholder);
    }

    init();
})();

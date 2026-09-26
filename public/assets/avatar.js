(() => {
    var avatarEl = document.getElementById("discord-avatar");
    var DISCORD_USER_ID = null;
    var PLACEHOLDER = "assets/images/avatar.png";

    avatarEl.crossOrigin = "anonymous";

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

        fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`)
            .then((res) => res.json())
            .then((data) => {
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
            .then((res) => res.json())
            .then((data) => {
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

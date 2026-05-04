gsap.registerPlugin(ScrollTrigger);

gsap.to(".progress-bar", {
    width: "100%",
    ease: "none",
    scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true
    }
});

gsap.to("#cat1", {
    y: 300,
    rotation: -360,
    scrollTrigger: {
        trigger: "#welcome",
        start: "top top",
        end: "bottom top",
        scrub: 3
    }
});

gsap.to("#cat2", {
    y: 300,            
    rotation: 360,      
    scrollTrigger: {
        trigger: "#welcome",
        start: "top top", 
        end: "bottom top", 
        scrub: 3      
    }
});

const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const results = document.getElementById("results");

if (searchInput && filterCategory && results) {
    const scenes = Array.from(document.querySelectorAll(".scene")).filter(
        (scene) => scene.id !== "welcome"
    );

    const extinctSceneIds = new Set([
        "european-cheetah",
        "cave-lion",
        "american-lion",
        "machairodontinae",
        "barbourofelidae",
        "nimravidae",
        "dinictis",
        "dinaelurus",
        "nimravus",
        "eusmilus",
        "hoplophoneus"
    ]);

    const getCategory = (sceneId) => (
        extinctSceneIds.has(sceneId) ? "extinct" : "modern"
    );

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const matchesWord = (text, token) => {
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}([^\\p{L}\\p{N}]|$)`, "iu");
        return pattern.test(text);
    };

    const applyFilters = () => {
        const query = searchInput.value.trim().toLowerCase();
        const queryTokens = query.split(/\s+/).filter(Boolean);
        const selectedCategory = filterCategory.value;
        let visibleCount = 0;

        scenes.forEach((scene) => {
            const h1Text = scene.querySelector("h1")?.textContent?.toLowerCase() || "";
            const pText = scene.querySelector("p")?.textContent?.toLowerCase() || "";
            const idText = scene.id.toLowerCase();
            const contentText = `${h1Text} ${pText}`;

            const matchesSearch = queryTokens.length === 0 || queryTokens.every(
                (token) => matchesWord(contentText, token) || idText.includes(token)
            );
            const matchesCategory = selectedCategory === "all"
                || getCategory(scene.id) === selectedCategory;
            const isVisible = matchesSearch && matchesCategory;

            scene.hidden = !isVisible;

            if (isVisible) {
                visibleCount += 1;
            }
        });

        results.textContent = visibleCount > 0
            ? `Найдено: ${visibleCount}`
            : "Ничего не найдено. Попробуйте другой запрос.";

        ScrollTrigger.refresh(true);
    };

    searchInput.addEventListener("input", applyFilters);
    filterCategory.addEventListener("change", applyFilters);
    applyFilters();
}
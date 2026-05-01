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
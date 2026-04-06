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
    y: 300,            // кошка будет падать вниз быстрее фона
    rotation: -360,      // немного наклонится
    scrollTrigger: {
        trigger: "#welcome",
        start: "top top", // начинаем, когда верх секции у верха экрана
        end: "bottom top", // заканчиваем, когда низ секции ушел вверх
        scrub: 3       // плавная привязка к скроллу (1 — для мягкости)
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

// gsap.to("#cat2", {
//     x: 200,            // пролетит слева направо
//     opacity: 1,        // проявится
//     scrollTrigger: {
//         trigger: "#ancient",
//         start: "top bottom", // начнет проявляться, как только секция покажется снизу
//         end: "center center",
//         scrub: 2
//     }
// });
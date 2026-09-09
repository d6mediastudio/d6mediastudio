/**
 * PRASATH SIVAGURU - PORTFOLIO ENGINE
 * Fixed-Pinning Canvas Engine (259-Frame Animation)
 */

(function () {
    'use strict';

    // Configuration Constants
    const TOTAL_FRAMES = 259;
    const FOLDER_NAME = 'portfolio file';
    const BASE_FILENAME = 'ezgif-frame-001';

    // DOM Elements
    const canvas = document.getElementById('sequenceCanvas');
    const ctx = canvas.getContext('2d');
    const heroSequence = document.getElementById('heroSequence');
    const heroSticky = document.getElementById('heroSticky');
    const heroIdentityStage = document.getElementById('heroIdentityStage');
    const siteHeader = document.getElementById('siteHeader');
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const toastNotification = document.getElementById('toastNotification');

    // Identity Animation State
    let identityChangeTimeout = null;

    /**
     * Scroll-Driven Identity Text Progression
     * Stage 1 (Frame 1-40): FOUNDER — D6 MEDIA STUDIO
     * Stage 2 (Frame 41-90): VIDEO EDITOR
     * Stage 3 (Frame 91-145): PHOTOGRAPHER
     * Stage 4 (Frame 146-205): PHOTO EDITOR
     * Stage 5 (Frame 206-259): VIDEOGRAPHER
     */
    function getIdentityTextForFrame(frame) {
        if (frame < 41) return 'FOUNDER — D6 MEDIA STUDIO';
        if (frame < 91) return 'VIDEO EDITOR';
        if (frame < 146) return 'PHOTOGRAPHER';
        if (frame < 206) return 'PHOTO EDITOR';
        return 'VIDEOGRAPHER';
    }

    function updateIdentityText(frame) {
        if (!heroIdentityStage) return;

        const targetText = getIdentityTextForFrame(frame);
        const currentText = heroIdentityStage.getAttribute('data-current-text');

        if (currentText !== targetText) {
            heroIdentityStage.setAttribute('data-current-text', targetText);
            heroIdentityStage.classList.add('changing');

            if (identityChangeTimeout) clearTimeout(identityChangeTimeout);

            identityChangeTimeout = setTimeout(() => {
                heroIdentityStage.textContent = targetText;
                heroIdentityStage.classList.remove('changing');
            }, 120);
        }
    }

    // Preloader & Frame Cache State
    const frameCache = new Array(TOTAL_FRAMES + 1);
    let targetFrame = 1;
    let isTicking = false;
    let lastLoadedValidFrame = null;

    /**
     * Exact frame path generator: portfolio file/ezgif-frame-001 (1).jpg
     */
    function getFramePath(frameNumber) {
        return `${FOLDER_NAME}/${BASE_FILENAME} (${frameNumber}).jpg`;
    }

    /**
     * Preload 259 frames into memory with prioritized chunking
     */
    function initFramePreloader() {
        // Priority 1: Load Frame 1 immediately
        const frame1 = new Image();
        frame1.src = getFramePath(1);
        frame1.onload = () => {
            frameCache[1] = frame1;
            lastLoadedValidFrame = frame1;
            renderFrame(1);
        };

        // Priority 2: Load initial 25 frames for instant scrolling responsiveness
        for (let i = 2; i <= Math.min(25, TOTAL_FRAMES); i++) {
            preloadSingleFrame(i);
        }

        // Priority 3: Background chunked preloading for frames 26..259
        setTimeout(() => {
            let index = 26;
            function loadNextChunk() {
                const chunkSize = 15;
                const limit = Math.min(index + chunkSize, TOTAL_FRAMES + 1);
                for (; index < limit; index++) {
                    preloadSingleFrame(index);
                }
                if (index <= TOTAL_FRAMES) {
                    requestAnimationFrame(loadNextChunk);
                }
            }
            requestAnimationFrame(loadNextChunk);
        }, 50);
    }

    function preloadSingleFrame(index) {
        if (frameCache[index]) return;
        const img = new Image();
        img.src = getFramePath(index);
        img.onload = () => {
            frameCache[index] = img;
            // Draw immediately if current scroll demands this frame
            if (index === targetFrame) {
                renderFrame(index);
            }
        };
    }

    /**
     * Fallback lookup: returns nearest available loaded frame if current frame is loading.
     * Guarantees ZERO white frames, blank canvas, or missing image icons.
     */
    function getNearestLoadedFrame(frameNumber) {
        if (frameCache[frameNumber]) return frameCache[frameNumber];

        // Search backward
        for (let i = frameNumber - 1; i >= 1; i--) {
            if (frameCache[i]) return frameCache[i];
        }

        // Search forward
        for (let i = frameNumber + 1; i <= TOTAL_FRAMES; i++) {
            if (frameCache[i]) return frameCache[i];
        }

        return lastLoadedValidFrame;
    }

    /**
     * Responsive Canvas Renderer with devicePixelRatio and aspect ratio cover fit
     */
    function renderFrame(frameNumber) {
        if (!canvas || !ctx) return;

        const imgToDraw = getNearestLoadedFrame(frameNumber);
        if (!imgToDraw || !imgToDraw.complete) return;

        lastLoadedValidFrame = imgToDraw;

        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Resize canvas internal buffer if resolution changed
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // Aspect ratio cover math
        const imgRatio = imgToDraw.width / imgToDraw.height;
        const canvasRatio = width / height;

        let drawWidth, drawHeight, drawX, drawY;

        if (canvasRatio > imgRatio) {
            drawWidth = width;
            drawHeight = width / imgRatio;
            drawX = 0;
            drawY = (height - drawHeight) / 2;
        } else {
            drawWidth = height * imgRatio;
            drawHeight = height;
            drawX = (width - drawWidth) / 2;
            drawY = 0;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(imgToDraw, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }

    /**
     * Guaranteed Scroll Pinning & Frame Mapping Engine
     */
    function handleScroll() {
        if (!heroSequence || !heroSticky) return;

        const seqRect = heroSequence.getBoundingClientRect();
        const totalScrollableDistance = seqRect.height - window.innerHeight;

        if (totalScrollableDistance <= 0) return;

        // Distance scrolled inside sequence container
        const currentScrollTop = -seqRect.top;

        // GUARANTEED VIEWPORT PINNING CONTROL
        if (currentScrollTop >= 0 && currentScrollTop < totalScrollableDistance) {
            // Actively inside sequence container: Lock viewport fixed at top: 0
            heroSticky.classList.add('pinned-fixed');
            heroSticky.classList.remove('pinned-bottom');
        } else if (currentScrollTop >= totalScrollableDistance) {
            // Sequence completed (Frame 259 reached and held): Anchor to bottom of container
            heroSticky.classList.remove('pinned-fixed');
            heroSticky.classList.add('pinned-bottom');
        } else {
            // Above sequence container
            heroSticky.classList.remove('pinned-fixed');
            heroSticky.classList.remove('pinned-bottom');
        }

        // ACTIVE FRAME CALCULATION
        // We play frames 1 -> 259 continuously from 0% to 88% of total scroll distance.
        // The remaining 12% holds Frame 259 before sticky container releases.
        const playRange = 0.88;
        let normalizedProgress = currentScrollTop / (totalScrollableDistance * playRange);
        normalizedProgress = Math.max(0, Math.min(1, normalizedProgress));

        // Map progress (0 -> 1) to 0-based frame index (0 -> 258)
        let zeroBasedIndex = Math.floor(normalizedProgress * (TOTAL_FRAMES - 1));
        zeroBasedIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, zeroBasedIndex));

        const calculatedFrame = zeroBasedIndex + 1; // 1 to 259
        targetFrame = calculatedFrame;

        // Update Scroll-Driven Identity Text Stage
        updateIdentityText(calculatedFrame);

        // Smooth requestAnimationFrame rendering pass
        if (!isTicking) {
            requestAnimationFrame(() => {
                renderFrame(targetFrame);
                isTicking = false;
            });
            isTicking = true;
        }

        // Header scrolled class
        if (siteHeader) {
            if (window.scrollY > 60) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }
        }
    }

    /**
     * Window Resize Handler
     */
    function handleResize() {
        renderFrame(targetFrame);
    }

    /**
     * Email Copy Interaction
     */
    function initEmailCopy() {
        if (!copyEmailBtn) return;

        copyEmailBtn.addEventListener('click', () => {
            const emailText = 'prasathsivaguru.editor@gmail.com';
            navigator.clipboard.writeText(emailText).then(() => {
                showToast('Email copied to clipboard!');
            }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = emailText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast('Email copied to clipboard!');
            });
        });
    }

    function showToast(message) {
        if (!toastNotification) return;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    }

    /**
     * Mobile Menu Navigation
     */
    function initMobileMenu() {
        if (!mobileToggle || !mobileMenu) return;

        mobileToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
            document.body.classList.toggle('no-scroll');
        });

        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                document.body.classList.remove('no-scroll');
            });
        });
    }



    /**
     * Video Gallery Lightbox
     */
    function initVideoGallery() {
        const galleryCards = document.querySelectorAll('.video-gallery-card');
        const lightbox = document.getElementById('videoLightbox');
        const lightboxVideo = document.getElementById('lightboxVideo');
        const lightboxTitle = document.getElementById('lightboxTitle');
        const lightboxMeta = document.getElementById('lightboxMeta');
        const lightboxClose = document.getElementById('lightboxClose');
        const backdrop = lightbox ? lightbox.querySelector('[data-close-lightbox]') : null;

        if (!galleryCards.length || !lightbox || !lightboxVideo) return;

        function closeLightbox() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            lightboxVideo.pause();
            lightboxVideo.removeAttribute('src');
            lightboxVideo.load();
            document.body.classList.remove('no-scroll');
        }

        galleryCards.forEach(card => {
            card.addEventListener('click', () => {
                const video = card.getAttribute('data-video');
                const title = card.getAttribute('data-title') || 'Video Project';
                const meta = card.getAttribute('data-meta') || '';
                lightboxVideo.src = video;
                lightboxTitle.textContent = title;
                lightboxMeta.textContent = meta;
                lightbox.classList.add('open');
                lightbox.setAttribute('aria-hidden', 'false');
                document.body.classList.add('no-scroll');
                lightboxVideo.play().catch(() => {});
            });
        });

        lightboxClose.addEventListener('click', closeLightbox);
        if (backdrop) backdrop.addEventListener('click', closeLightbox);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
        });
    }

    /**
     * Initialize Portfolio App
     */
    function init() {
        initFramePreloader();
        initEmailCopy();
        initMobileMenu();
        initVideoGallery();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        // Initial render pass
        handleScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

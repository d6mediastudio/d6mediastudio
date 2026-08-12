const { spawn } = require('child_process');

async function testCleanup() {
    console.log('Launching headless Chrome for UI Cleanup verification...');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--window-size=1280,800',
        'http://localhost:8080'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const res = await fetch('http://localhost:9222/json');
        const tabs = await res.json();
        const pageTab = tabs.find(t => t.url.includes('localhost:8080')) || tabs[0];
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        await new Promise(r => ws.onopen = r);
        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = msgId++;
                const handler = (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === id) {
                        ws.removeEventListener('message', handler);
                        resolve(msg.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await send('Runtime.enable');

        async function evalJs(expr) {
            const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
            return res && res.result ? res.result.value : null;
        }

        console.log('\n--- VERIFYING OVERLAY REMOVAL ---');

        const elementsCheck = await evalJs(`
            (() => {
                return {
                    scrollPrompt: !!document.querySelector('.scroll-prompt'),
                    frameCounter: !!document.getElementById('frameCounter'),
                    badgePill: !!document.querySelector('.badge-pill'),
                    heroTitle: document.querySelector('.hero-title')?.innerText.trim(),
                    heroSubtitle: document.querySelector('.hero-subtitle')?.innerText.trim(),
                    canvas: !!document.getElementById('sequenceCanvas')
                };
            })()
        `);

        console.log('DOM Elements Check:');
        console.log('  - Scroll Prompt ("SCROLL TO EXPERIENCE SEQUENCE"):', elementsCheck.scrollPrompt ? 'EXISTS (FAIL)' : 'REMOVED (PASS)');
        console.log('  - Frame Counter ("SEQUENCE 001 / 259"):', elementsCheck.frameCounter ? 'EXISTS (FAIL)' : 'REMOVED (PASS)');
        console.log('  - Badge Pill ("CINEMATIC PORTFOLIO"):', elementsCheck.badgePill ? 'EXISTS (FAIL)' : 'REMOVED (PASS)');
        console.log('  - Hero Title:', elementsCheck.heroTitle);
        console.log('  - Hero Subtitle:', elementsCheck.heroSubtitle ? 'PRESENT (PASS)' : 'MISSING (FAIL)');
        console.log('  - Canvas element:', elementsCheck.canvas ? 'PRESENT (PASS)' : 'MISSING (FAIL)');

        console.log('\n--- VERIFYING SCROLL ANIMATION & PINNING ---');

        const scrollPositions = [0, 500, 1500, 2500, 3500];

        for (const scrollY of scrollPositions) {
            await evalJs(`window.scrollTo(0, ${scrollY});`);
            await new Promise(r => setTimeout(r, 100));

            const info = await evalJs(`
                (() => {
                    const sticky = document.getElementById('heroSticky');
                    const story = document.getElementById('storyline');
                    const stickyRect = sticky ? sticky.getBoundingClientRect() : {};
                    const storyRect = story ? story.getBoundingClientRect() : {};

                    return {
                        scrollY: Math.round(window.scrollY),
                        stickyTop: Math.round(stickyRect.top),
                        stickyHeight: Math.round(stickyRect.height),
                        storyTop: Math.round(storyRect.top),
                        isStoryInViewport: storyRect.top < window.innerHeight
                    };
                })()
            `);

            console.log(`ScrollY: ${info.scrollY}px | StickyTop: ${info.stickyTop}px | StoryTop: ${info.storyTop}px | StoryInViewport: ${info.isStoryInViewport}`);
        }

        ws.close();
        chrome.kill();
    } catch(e) {
        console.error(e);
        chrome.kill();
    }
}

testCleanup();

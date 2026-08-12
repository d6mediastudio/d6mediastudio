const { spawn } = require('child_process');

async function verifyIdentityAnimation() {
    console.log('Launching headless Chrome for Scroll-Driven Identity Text Verification...');
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

        console.log('\n--- FORWARD SCROLL IDENTITY SEQUENCE TEST ---');

        const scrollTestPoints = [
            { scrollY: 0, expectedText: 'PRASATH SIVAGURU' },
            { scrollY: 600, expectedText: 'VIDEO EDITOR' },
            { scrollY: 1300, expectedText: 'PHOTOGRAPHER' },
            { scrollY: 2000, expectedText: 'PHOTO EDITOR' },
            { scrollY: 2800, expectedText: 'FOUNDER OF D6 MEDIA STUDIO' },
            { scrollY: 3400, expectedText: 'FOUNDER OF D6 MEDIA STUDIO' }
        ];

        for (const pt of scrollTestPoints) {
            await evalJs(`window.scrollTo(0, ${pt.scrollY});`);
            await new Promise(r => setTimeout(r, 250));

            const info = await evalJs(`
                (() => {
                    const el = document.getElementById('heroIdentityStage');
                    const counter = document.getElementById('frameCounter');
                    return {
                        scrollY: Math.round(window.scrollY),
                        identityText: el ? el.innerText.trim() : '',
                        isMotionGraphicsPresent: el ? el.innerText.includes('MOTION GRAPHICS') : false
                    };
                })()
            `);

            console.log(`ScrollY: ${info.scrollY}px | Identity Text: "${info.identityText}" | Motion Graphics Present: ${info.isMotionGraphicsPresent}`);
        }

        console.log('\n--- REVERSE SCROLL IDENTITY SEQUENCE TEST ---');

        const reversePoints = [3000, 2000, 1300, 600, 0];
        for (const sy of reversePoints) {
            await evalJs(`window.scrollTo(0, ${sy});`);
            await new Promise(r => setTimeout(r, 250));

            const info = await evalJs(`
                (() => {
                    const el = document.getElementById('heroIdentityStage');
                    return {
                        scrollY: Math.round(window.scrollY),
                        identityText: el ? el.innerText.trim() : ''
                    };
                })()
            `);

            console.log(`REVERSE ScrollY: ${info.scrollY}px | Identity Text: "${info.identityText}"`);
        }

        console.log('\n--- HERO ANIMATION & CANVAS INTEGRITY ---');
        const heroCheck = await evalJs(`
            (() => {
                const canvas = document.getElementById('sequenceCanvas');
                const heroSticky = document.getElementById('heroSticky');
                return {
                    canvasExists: !!canvas,
                    stickyExists: !!heroSticky
                };
            })()
        `);

        console.log('Hero Canvas Check:', heroCheck);

        ws.close();
        chrome.kill();
    } catch (e) {
        console.error(e);
        chrome.kill();
    }
}

verifyIdentityAnimation();

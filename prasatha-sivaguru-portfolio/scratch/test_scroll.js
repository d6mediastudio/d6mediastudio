const { spawn } = require('child_process');

async function runTest() {
    console.log('Launching headless Chrome...');
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

        console.log('\n--- EXTENDED SCROLL & TRANSITION VERIFICATION ---');

        const scrollPositions = [0, 500, 1000, 1500, 2000, 2500, 3000, 3200, 3500, 3800, 4200, 4500];

        for (const scrollY of scrollPositions) {
            await evalJs(`window.scrollTo(0, ${scrollY});`);
            await new Promise(r => setTimeout(r, 100));

            const info = await evalJs(`
                (() => {
                    const sticky = document.getElementById('heroSticky');
                    const counter = document.getElementById('frameCounter');
                    const story = document.getElementById('storyline');
                    
                    const stickyRect = sticky ? sticky.getBoundingClientRect() : {};
                    const storyRect = story ? story.getBoundingClientRect() : {};

                    return {
                        scrollY: Math.round(window.scrollY),
                        stickyTop: Math.round(stickyRect.top),
                        stickyHeight: Math.round(stickyRect.height),
                        counterText: counter ? counter.textContent : '',
                        storyTop: Math.round(storyRect.top),
                        isStoryInViewport: storyRect.top < window.innerHeight
                    };
                })()
            `);

            console.log(`ScrollY: ${info.scrollY}px | StickyTop: ${info.stickyTop}px | Counter: "${info.counterText}" | StoryTop: ${info.storyTop}px | StoryInViewport: ${info.isStoryInViewport}`);
        }

        ws.close();
        chrome.kill();
    } catch(e) {
        console.error(e);
        chrome.kill();
    }
}

runTest();

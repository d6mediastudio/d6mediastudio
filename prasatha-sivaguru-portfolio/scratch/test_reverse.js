const { spawn } = require('child_process');

async function testReverse() {
    console.log('Launching headless Chrome for Reverse Scroll test...');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
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

        console.log('\n--- TESTING REVERSE SCROLL ---');

        // Scroll down to 3000px
        await evalJs(`window.scrollTo(0, 3000);`);
        await new Promise(r => setTimeout(r, 200));

        // Now scroll back UP to 2000px, 1000px, 0px
        const reversePositions = [3000, 2000, 1000, 500, 0];

        for (const scrollY of reversePositions) {
            await evalJs(`window.scrollTo(0, ${scrollY});`);
            await new Promise(r => setTimeout(r, 150));

            const info = await evalJs(`
                (() => {
                    const sticky = document.getElementById('heroSticky');
                    const counter = document.getElementById('frameCounter');
                    const stickyRect = sticky ? sticky.getBoundingClientRect() : {};
                    return {
                        scrollY: Math.round(window.scrollY),
                        stickyTop: Math.round(stickyRect.top),
                        counterText: counter ? counter.textContent : ''
                    };
                })()
            `);

            console.log(`REVERSE ScrollY: ${info.scrollY}px | StickyTop: ${info.stickyTop}px | Counter: "${info.counterText}"`);
        }

        ws.close();
        chrome.kill();
    } catch(e) {
        console.error(e);
        chrome.kill();
    }
}

testReverse();

const { spawn } = require('child_process');

async function checkResponsiveHeadings() {
    const viewports = [
        { w: 1440, h: 900 },
        { w: 1280, h: 800 },
        { w: 1024, h: 768 },
        { w: 900, h: 700 },
        { w: 768, h: 800 },
        { w: 480, h: 800 },
        { w: 360, h: 640 }
    ];

    for (const vp of viewports) {
        const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
            '--headless=new',
            '--remote-debugging-port=9222',
            `--window-size=${vp.w},${vp.h}`,
            'http://localhost:8080'
        ]);

        await new Promise(r => setTimeout(r, 1500));

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

            const info = await send('Runtime.evaluate', {
                expression: `(() => {
                    const t = document.querySelector('.narrative-card[data-step="01"] .card-title');
                    const card = document.querySelector('.narrative-card[data-step="01"]');
                    if (!t || !card) return null;
                    return {
                        viewport: "${vp.w}x${vp.h}",
                        cardWidth: card.offsetWidth,
                        titleScrollWidth: t.scrollWidth,
                        titleClientWidth: t.clientWidth,
                        isOverflowing: t.scrollWidth > t.clientWidth,
                        textLines: t.getClientRects().length
                    };
                })()`,
                returnByValue: true
            });

            console.log(JSON.stringify(info.result.value));

            ws.close();
            chrome.kill();
        } catch(e) {
            console.error(e);
            chrome.kill();
        }
    }
}

checkResponsiveHeadings();

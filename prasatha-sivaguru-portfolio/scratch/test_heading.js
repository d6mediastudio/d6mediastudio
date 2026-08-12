const { spawn } = require('child_process');

async function checkHeading() {
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

        const info = await send('Runtime.evaluate', {
            expression: `(() => {
                const titles = document.querySelectorAll('.narrative-card .card-title');
                return Array.from(titles).map((t, idx) => {
                    return {
                        card: idx + 1,
                        text: t.innerText.trim(),
                        scrollWidth: t.scrollWidth,
                        clientWidth: t.clientWidth,
                        offsetWidth: t.offsetWidth,
                        isOverflowing: t.scrollWidth > t.clientWidth
                    };
                });
            })()`,
            returnByValue: true
        });

        console.log('NARRATIVE CARD TITLES MEASUREMENT:');
        console.log(JSON.stringify(info.result.value, null, 2));

        ws.close();
        chrome.kill();
    } catch(e) {
        console.error(e);
        chrome.kill();
    }
}

checkHeading();

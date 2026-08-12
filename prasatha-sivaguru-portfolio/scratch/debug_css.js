const { spawn } = require('child_process');

async function debugCss() {
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

        const info = await send('Runtime.evaluate', {
            expression: `(() => {
                function getInfo(el) {
                    if (!el) return null;
                    const s = window.getComputedStyle(el);
                    return {
                        tag: el.tagName,
                        id: el.id,
                        class: el.className,
                        position: s.position,
                        overflow: s.overflow,
                        overflowX: s.overflowX,
                        overflowY: s.overflowY,
                        height: s.height,
                        display: s.display,
                        transform: s.transform
                    };
                }
                const sticky = document.getElementById('heroSticky');
                let curr = sticky;
                const chain = [];
                while (curr) {
                    chain.push(getInfo(curr));
                    curr = curr.parentElement;
                }
                return chain;
            })()`,
            returnByValue: true
        });

        console.log('ANCESTOR CHAIN COMPUTED STYLES:');
        console.log(JSON.stringify(info.result.value, null, 2));

        ws.close();
        chrome.kill();
    } catch (e) {
        console.error(e);
        chrome.kill();
    }
}

debugCss();

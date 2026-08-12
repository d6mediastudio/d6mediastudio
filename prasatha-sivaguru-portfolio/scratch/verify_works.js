const { spawn } = require('child_process');

async function verifyWorks() {
    console.log('Launching headless Chrome for Selected Works verification...');
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

        console.log('\n--- VERIFYING SELECTED WORKS CARDS & MEDIA ---');

        const cardData = await evalJs(`
            (() => {
                const cards = document.querySelectorAll('.portfolio-card');
                return Array.from(cards).map((card, idx) => {
                    const title = card.querySelector('.card-title')?.innerText.trim();
                    const cat = card.getAttribute('data-category');
                    const video = card.querySelector('video');
                    const img = card.querySelector('img');
                    return {
                        index: idx + 1,
                        title,
                        category: cat,
                        mediaType: video ? 'VIDEO' : (img ? 'IMAGE' : 'NONE'),
                        src: video ? video.getAttribute('src') : (img ? img.getAttribute('src') : null),
                        videoPaused: video ? video.paused : null,
                        videoMuted: video ? video.muted : null
                    };
                });
            })()
        `);

        console.log('Cards found:', cardData.length);
        cardData.forEach(c => {
            console.log(`Card ${c.index} | Title: "${c.title}" | Category: ${c.category} | Type: ${c.mediaType} | Src: ${c.src}`);
        });

        console.log('\n--- VERIFYING CATEGORY FILTERING ---');

        const filters = ['all', 'cinematic', 'reels', 'color', 'motion', 'photo'];
        for (const f of filters) {
            await evalJs(`
                (() => {
                    const btn = document.querySelector('.filter-btn[data-filter="${f}"]');
                    if (btn) btn.click();
                })()
            `);
            await new Promise(r => setTimeout(r, 100));

            const visibleCount = await evalJs(`
                (() => {
                    const cards = document.querySelectorAll('.portfolio-card');
                    return Array.from(cards).filter(c => window.getComputedStyle(c).display !== 'none').length;
                })()
            `);

            console.log(`Filter: "${f}" -> Visible Cards: ${visibleCount}`);
        }

        console.log('\n--- VERIFYING HERO ANIMATION INTEGRITY ---');
        const heroCheck = await evalJs(`
            (() => {
                const canvas = document.getElementById('sequenceCanvas');
                const heroSticky = document.getElementById('heroSticky');
                return {
                    canvasExists: !!canvas,
                    canvasWidth: canvas ? canvas.width : 0,
                    canvasHeight: canvas ? canvas.height : 0,
                    stickyExists: !!heroSticky
                };
            })()
        `);

        console.log('Hero Check:', heroCheck);

        ws.close();
        chrome.kill();
    } catch (e) {
        console.error(e);
        chrome.kill();
    }
}

verifyWorks();

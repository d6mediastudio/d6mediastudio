const { spawn } = require('child_process');

async function verifyCorrections() {
    console.log('Launching headless Chrome for Verification of 2 Corrections...');
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--window-size=1440,900',
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

        console.log('\n--- 1. SERVICE CARD HEADING OVERFLOW VERIFICATION ---');

        const headingCheck = await evalJs(`
            (() => {
                const title = document.querySelector('.narrative-card[data-step="01"] .card-title');
                const card = document.querySelector('.narrative-card[data-step="01"]');
                return {
                    text: title ? title.innerText.trim() : '',
                    scrollWidth: title ? title.scrollWidth : 0,
                    clientWidth: title ? title.clientWidth : 0,
                    cardWidth: card ? card.offsetWidth : 0,
                    isOverflowing: title ? title.scrollWidth > title.clientWidth : false
                };
            })()
        `);

        console.log('Service Card 01 Heading Check:', headingCheck);
        console.log('Overflow status:', headingCheck.isOverflowing ? 'FAILED (Overflowing)' : 'PASSED (No clipping)');

        console.log('\n--- 2. COLOR GRADING REEL CATEGORY & FILTER VERIFICATION ---');

        // Check Color Grading filter
        await evalJs(`document.querySelector('.filter-btn[data-filter="color"]')?.click();`);
        await new Promise(r => setTimeout(r, 100));

        const colorFilterCards = await evalJs(`
            (() => {
                const cards = document.querySelectorAll('.portfolio-card');
                return Array.from(cards).filter(c => window.getComputedStyle(c).display !== 'none').map(c => {
                    return {
                        title: c.querySelector('.card-title')?.innerText.trim(),
                        categoryLabel: c.querySelector('.card-cat')?.innerText.trim(),
                        dataCategory: c.getAttribute('data-category')
                    };
                });
            })()
        `);

        console.log('Cards visible under "Color Grading" filter:');
        console.table(colorFilterCards);

        // Check Cinematic Cuts filter
        await evalJs(`document.querySelector('.filter-btn[data-filter="cinematic"]')?.click();`);
        await new Promise(r => setTimeout(r, 100));

        const cinematicFilterCards = await evalJs(`
            (() => {
                const cards = document.querySelectorAll('.portfolio-card');
                return Array.from(cards).filter(c => window.getComputedStyle(c).display !== 'none').map(c => {
                    return {
                        title: c.querySelector('.card-title')?.innerText.trim(),
                        categoryLabel: c.querySelector('.card-cat')?.innerText.trim(),
                        dataCategory: c.getAttribute('data-category')
                    };
                });
            })()
        `);

        console.log('Cards visible under "Cinematic Cuts" filter:');
        console.table(cinematicFilterCards);

        ws.close();
        chrome.kill();
    } catch(e) {
        console.error(e);
        chrome.kill();
    }
}

verifyCorrections();

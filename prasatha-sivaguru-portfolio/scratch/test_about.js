const { spawn } = require('child_process');

async function verifyAboutSection() {
    console.log('Launching headless Chrome for About Section Verification...');
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

        console.log('\n--- VERIFYING ABOUT SECTION COPY & PILLARS ---');

        const aboutData = await evalJs(`
            (() => {
                const aboutText = document.querySelector('.about-text')?.innerText.trim();
                const pillars = Array.from(document.querySelectorAll('.pillar-item')).map(p => ({
                    title: p.querySelector('h4')?.innerText.trim(),
                    desc: p.querySelector('p')?.innerText.trim()
                }));
                return { aboutText, pillars };
            })()
        `);

        console.log('About Paragraph Text:');
        console.log(`"${aboutData.aboutText}"`);
        console.log('\nContains "Motion Graphics"?:', aboutData.aboutText.toLowerCase().includes('motion graphics') ? 'FAIL' : 'PASS (Clean)');

        console.log('\nExpertise Pillars Found:');
        aboutData.pillars.forEach((p, i) => {
            console.log(`Pillar ${i+1}: "${p.title}" -> "${p.desc}"`);
        });

        console.log('\n--- VERIFYING HERO ANIMATION INTEGRITY ---');
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

        console.log('Hero Check:', heroCheck);

        ws.close();
        chrome.kill();
    } catch (e) {
        console.error(e);
        chrome.kill();
    }
}

verifyAboutSection();

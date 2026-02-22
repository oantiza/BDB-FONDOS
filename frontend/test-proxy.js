const https = require('https');

const proxies = [
    'https://api.allorigins.win/get?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/'
];
const target = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

async function testProxies() {
    for (const p of proxies) {
        try {
            const urlStr = p + encodeURIComponent(target);
            console.log(`Testing: ${p}`);
            const resp = await fetch(urlStr, { signal: AbortSignal.timeout(5000) });
            console.log(`Status: ${resp.status}`);
            if (resp.ok) {
                const text = await resp.text();
                console.log(`Length: ${text.length}`);
                if (text.includes('title')) {
                    console.log('SUCCESS!');
                }
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}
testProxies();

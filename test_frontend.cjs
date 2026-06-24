const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log("Navigating to http://localhost:5174/...");
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
  
  console.log("Waiting 3 seconds for React to mount...");
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Typing message...");
  await page.type('input[type="text"]', "Hello Ciphra!");
  await page.click('.send-btn');
  
  console.log("Waiting 6 seconds for AI response and TTS...");
  await new Promise(r => setTimeout(r, 6000));

  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log("Body length:", bodyHTML.length);
  
  await page.screenshot({ path: 'screenshot.png' });
  console.log("Saved screenshot.png");
  
  await browser.close();
})();

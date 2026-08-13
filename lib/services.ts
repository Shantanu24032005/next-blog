import { google } from 'googleapis';
import tumblr from 'tumblr.js';
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const clipboardy = require('clipboardy');
import fs from 'fs';

puppeteer.use(StealthPlugin());

export interface PublishResult {
  action: string;
  status: string;
  url?: string;
  error?: string;
}

// Pastes text via the real OS clipboard + Ctrl+V to avoid Medium's Clipboard API restrictions[cite: 5]
async function pasteText(page: any, text: string) {
  await clipboardy.write(text);
  await page.bringToFront(); 
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyV');
  await page.keyboard.up('Control');
}

export const publishToMedium = async (title: string, bodyText: string, imageUrl?: string | null): Promise<PublishResult> => {
  let cookies: any[] = [];
  const cookiesEnv = process.env.MEDIUM_COOKIES;
  const cookieFilePath = process.env.COOKIE_FILE_PATH;

  // Load cookies from environment variables or file path[cite: 5]
  if (cookiesEnv) {
    try { 
      cookies = JSON.parse(cookiesEnv); 
    } catch (err: any) { 
      throw new Error(`MEDIUM_COOKIES JSON error: ${err.message}`); 
    }
  } else if (cookieFilePath && fs.existsSync(cookieFilePath)) {
    try {
      const rawData = fs.readFileSync(cookieFilePath, 'utf8').trim();
      if (rawData) cookies = JSON.parse(rawData);
    } catch (err: any) { 
      throw new Error(`Cookie file error: ${err.message}`); 
    }
  }

  if (!cookies || cookies.length === 0) {
    throw new Error("No valid Medium cookies provided.");
  }

  let browser;
  try {
    // Launch headless browser with specific flags for cloud environments[cite: 5]
    browser = await puppeteer.launch({ 
        headless: false, // <-- Change this from true to false
        defaultViewport: null, // <-- Add this so it opens full screen
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    const page = await browser.newPage();

    const normalizedCookies = cookies.map(c => ({
      domain: c.domain || '.medium.com',
      path: c.path || '/',
      ...c
    }));
    await page.setCookie(...normalizedCookies);

    console.log("[MediumService] Navigating to editor...");
    await page.goto('https://medium.com/new-story', { waitUntil: 'networkidle2' });

    if (page.url().includes('/signin') || !page.url().includes('/new-story')) {
      throw new Error("Authentication failed: Session cookies are invalid or expired.");
    }

    // Wait for the editor to load[cite: 5]
    await page.waitForSelector("[contenteditable='true'], [data-placeholder='Title'], h3", { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("[MediumService] Inserting Title...");
    await page.click("[data-placeholder='Title'], h3");
    await pasteText(page, title);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));

    // Embed Image if provided[cite: 5]
    if (imageUrl) {
      console.log(`[MediumService] Inserting image from Cloudinary...`);
      await pasteText(page, imageUrl);
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 4000)); // Wait for Medium to auto-unfurl[cite: 5]
    }

    console.log("[MediumService] Inserting Body Text...");
    await pasteText(page, bodyText);
    await new Promise(r => setTimeout(r, 1000));

    console.log("[MediumService] Opening publish panel...");
    await page.waitForSelector("button", { timeout: 10000 });
    const openedPanel = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
      const btn = candidates.find(
        (b: any) => b.innerText.trim().toLowerCase() === 'publish'
      );
      if (btn) {
        btn.setAttribute('data-nav-publish-btn', 'true');
        (btn as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (!openedPanel) {
      const allClickables = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, [role="button"], a'))
          .map((b: any) => `[${b.tagName}] "${b.innerText.trim()}"`)
          .filter(t => !t.endsWith('""'))
      );
      throw new Error(`Could not find the initial "Publish" button. Clickable elements on page: ${JSON.stringify(allClickables)}`);
    }

    console.log("[MediumService] Confirming publication...");
    try {
      // Poll for the confirm button[cite: 5]
      await page.waitForFunction(() => {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
        const btn = candidates.find((b: any) => {
          if (b.hasAttribute('data-nav-publish-btn')) return false; 
          const text = b.innerText.trim().toLowerCase();
          return text.includes('publish now') || text.includes('publish story') || text === 'publish';
        });
        if (btn) {
          btn.setAttribute('data-puppeteer-target', 'final-publish-btn');
          return true;
        }
        return false;
      }, { timeout: 10000, polling: 250 });
    } catch (err) {
      const allClickables = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, [role="button"], a'))
          .map((b: any) => `[${b.tagName}${b.hasAttribute('data-nav-publish-btn') ? ' NAV-BTN' : ''}] "${b.innerText.trim()}"`)
          .filter(t => !t.endsWith('""'))
      );
      throw new Error(`Failed to find the final publish button. Clickable elements on page: ${JSON.stringify(allClickables)}`);
    }

    await Promise.all([
      page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle2' }).catch(() => {}),
      page.click('[data-puppeteer-target="final-publish-btn"]')
    ]);

    console.log("[MediumService] Post published successfully!");
    await new Promise(r => setTimeout(r, 5000));

    return { action: "published", status: "success", url: page.url() };

  } finally {
    if (browser) await browser.close();
  }
};

export const publishToBlogger = async (title: string, bodyText: string, imageUrl?: string | null): Promise<PublishResult> => {
  try {
    const { BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN, BLOGGER_BLOG_ID } = process.env;
    const oauth2Client = new google.auth.OAuth2(BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET);
    
    oauth2Client.setCredentials({ refresh_token: BLOGGER_REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

    let contentHtml = imageUrl ? `<img src="${imageUrl}" alt="${title}" style="max-width:100%;"><br><br>` : '';
    contentHtml += bodyText.replace(/\n/g, '<br>');

    const response = await blogger.posts.insert({
      blogId: BLOGGER_BLOG_ID as string,
      isDraft: false,
      requestBody: { title, content: contentHtml }
    });

    return { action: "published", status: "success", url: response.data.url as string };
  } catch (error: any) {
    throw new Error(`Blogger Publish Failed: ${error.message}`);
  }
};

export const publishToDevTo = async (title: string, bodyText: string, imageUrl?: string | null): Promise<PublishResult> => {
  try {
    const apiKey = process.env.DEV_TO_API_KEY;
    const articlePayload: any = { article: { title, body_markdown: bodyText, published: true } };
    
    if (imageUrl) articlePayload.article.main_image = imageUrl;

    const response = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey as string },
      body: JSON.stringify(articlePayload)
    });

    if (!response.ok) throw new Error(await response.text());
    
    const data = await response.json();
    return { action: "published", status: "success", url: data.url };
  } catch (error: any) {
    throw new Error(`Dev.to Publish Failed: ${error.message}`);
  }
};

export const publishToTumblr = async (title: string, bodyText: string, imageUrl?: string | null): Promise<PublishResult> => {
  try {
    const { TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET, TUMBLR_BLOG_IDENTIFIER } = process.env;
    
    const client = tumblr.createClient({
      consumer_key: TUMBLR_CONSUMER_KEY as string,
      consumer_secret: TUMBLR_CONSUMER_SECRET as string,
      token: TUMBLR_TOKEN as string,
      token_secret: TUMBLR_TOKEN_SECRET as string
    });

    let contentHtml = imageUrl ? `<img src="${imageUrl}" alt="${title}" style="max-width:100%;"><br><br>` : '';
    contentHtml += bodyText.replace(/\n/g, '<br>');

    // createLegacyPost lacks direct TS definitions in some tumblr.js versions
    const response: any = await client.createLegacyPost(TUMBLR_BLOG_IDENTIFIER as string, {
      type: 'text',
      title: title,
      body: contentHtml,
      state: 'published'
    });

    // UPDATED: Added www.tumblr.com/ before the identifier
    return { action: "published", status: "success", url: `https://www.tumblr.com/${TUMBLR_BLOG_IDENTIFIER}/post/${response.id}` };
  } catch (error: any) {
    throw new Error(`Tumblr Publish Failed: ${error.message}`);
  }
};
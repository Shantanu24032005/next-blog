import { google } from 'googleapis';
import tumblr from 'tumblr.js';

export interface PublishResult {
  action: string;
  status: string;
  url?: string;
}

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
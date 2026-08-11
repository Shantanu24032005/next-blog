import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ success: false, error: "Prompt is required" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-3.6-flash',
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const systemPrompt = `
      You are Pratham Shankwalker, Founder & CEO of Venura[cite: 3]. Write a blog post based on the following topic.
      Follow these rules strictly:
      - Tone: Conversational but authoritative. First-person perspective ("I built Venura..."). No jargon or hype words[cite: 3].
      - Claims: Include pricing (₹999/month), free trial (30 days), setup time (48 hours)[cite: 3].
      - Structure[cite: 3]:
        1. Opening Quote
        2. Problem Statement (h2 + p)
        3. Solution Breakdown (h2 + h3 + p sections, 3-10 actionable points)
        4. Comparison or Checklist (list)
        5. Why Venura (h2 + p)
        6. FAQ Section (h3 + p pairs, 2-4 questions)
        7. CTA (p): "Start your free 30-day trial at usevenura.com — no payment required, no setup fees, cancel anytime."[cite: 3]
      - Badges/Categories[cite: 3]:
        - Buyer's Guide -> badge: "Buyer's Guide", badgeBg: "rgba(19,91,236,0.9)"
        - Tips & Tricks -> badge: "Tips & Tricks", badgeBg: "rgba(5,150,105,0.9)"
        - Industry Trends -> badge: "Industry Trends", badgeBg: "rgba(79,70,229,0.9)"
        - Event Management -> badge: "Event Management", badgeBg: "rgba(245,158,11,0.9)"
        - Revenue Growth -> badge: "Business Growth", badgeBg: "rgba(19,91,236,0.9)"
      - Image Naming: /images/[primary-keyword]-[descriptor].png[cite: 3]

      Return ONLY a JSON object matching this exact TypeScript interface[cite: 4]:
      {
        "slug": "keyword-rich-hyphenated-slug",
        "title": "SEO Optimized Title",
        "category": "Selected Category",
        "tags": ["tag1", "tag2"],
        "badge": "Matching badge text",
        "badgeBg": "Matching badge color",
        "description": "Under 155 chars meta description",
        "date": "August 11, 2026",
        "readTime": "X min read",
        "featuredImage": "/images/...",
        "cardImage": "/images/...",
        "sidebarImage": "/images/...",
        "author": {
          "name": "Pratham Shankwalker",
          "role": "Founder & CEO, Venura",
          "avatar": "/images/author-pratham.png"
        },
        "content": [
          { "type": "quote", "text": "..." },
          { "type": "h2", "text": "..." },
          { "type": "p", "text": "..." },
          { "type": "list", "items": ["...", "..."] }
        ]
      }
      
      Topic: ${prompt}
    `;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();
        const data = JSON.parse(responseText);

        // Convert the structured JSON content blocks into standard Markdown for Dev.to/Tumblr/Blogger
        let markdownBody = "";
        if (data.content && Array.isArray(data.content)) {
            data.content.forEach((block: any) => {
                if (block.type === 'quote') markdownBody += `> ${block.text}\n\n`;
                else if (block.type === 'h2') markdownBody += `## ${block.text}\n\n`;
                else if (block.type === 'h3') markdownBody += `### ${block.text}\n\n`;
                else if (block.type === 'p') markdownBody += `${block.text}\n\n`;
                else if (block.type === 'list' && block.items) {
                    block.items.forEach((item: string) => markdownBody += `- ${item}\n`);
                    markdownBody += '\n';
                }
            });
        }

        // Return the title, the markdown version for posting, and the raw JSON for the codebase
        return NextResponse.json({
            success: true,
            data: {
                title: data.title,
                bodyText: markdownBody.trim(),
                rawJson: JSON.stringify(data, null, 2)
            }
        });

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
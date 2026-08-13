import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { uploadImage } from '@/lib/cloudinary';
import { 
  publishToBlogger, 
  publishToDevTo, 
  publishToTumblr, 
  publishToMedium 
} from '@/lib/services';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const title = formData.get('title') as string | null;
    const bodyText = formData.get('bodyText') as string | null;
    const image = formData.get('image') as File | null;

    if (!title || !bodyText) {
      return NextResponse.json({ success: false, error: "Title and bodyText are required." }, { status: 400 });
    }

    let imageUrl: string | null = null;
    if (image && typeof image === 'object') {
      const buffer = Buffer.from(await image.arrayBuffer());
      imageUrl = await uploadImage(buffer);
    }

    // Append your standard footer
    const footer = `\n\n**Venura**\nIndia's #1 banquet hall management software. Venura helps venue owners manage bookings, payments, and operations.\n\n**Website:** https://www.usevenura.com/\n\n© 2026 Venura Technologies Inc. All rights reserved.`;
    const finalBodyText = bodyText + footer;

    // Fire all publishing services concurrently
    const results = await Promise.allSettled([
      publishToBlogger(title, finalBodyText, imageUrl),
      publishToDevTo(title, finalBodyText, imageUrl),
      publishToTumblr(title, finalBodyText, imageUrl),
      publishToMedium(title, finalBodyText, imageUrl)
    ]);

    // Helper to safely extract results
    const getResult = (promise: PromiseSettledResult<any>) => 
      promise.status === 'fulfilled' ? promise.value : { status: 'failed', error: promise.reason.message };
    
    const bloggerResult = getResult(results[0]);
    const devtoResult = getResult(results[1]);
    const tumblrResult = getResult(results[2]);
    const mediumResult = getResult(results[3]);

    console.log("Medium Result:", mediumResult);

    const blogDoc = {
      title,
      bodyText,
      imageUrl, // Saved to Firebase
      bloggerUrl: bloggerResult.status === 'success' ? bloggerResult.url : bloggerResult.error,
      devtoUrl: devtoResult.status === 'success' ? devtoResult.url : devtoResult.error,
      tumblrUrl: tumblrResult.status === 'success' ? tumblrResult.url : tumblrResult.error,
      mediumUrl: mediumResult.status === 'success' ? mediumResult.url : mediumResult.error,
      publishedAt: new Date().toISOString()
    };

    // Save the record to Firebase
    const docRef = await addDoc(collection(db, 'blogs'), blogDoc);

    return NextResponse.json({ 
      success: true, 
      message: "Published successfully", 
      data: { id: docRef.id, ...blogDoc } 
    });

  } catch (error: any) {
    console.error("Publishing error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
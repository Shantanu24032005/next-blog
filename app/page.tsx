'use client';

import { useState, useEffect, FormEvent } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

interface Blog {
  id: string;
  title: string;
  bodyText?: string;
  bloggerUrl?: string;
  devtoUrl?: string;
  tumblrUrl?: string;
  publishedAt: string;
}

export default function BlogManager() {
  const [title, setTitle] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [rawJsonOutput, setRawJsonOutput] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  const [message, setMessage] = useState<string>('');
  const [blogs, setBlogs] = useState<Blog[]>([]);

  const fetchBlogs = async () => {
    try {
      const q = query(collection(db, 'blogs'), orderBy('publishedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const blogsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Blog, 'id'>)
      }));
      setBlogs(blogsData);
    } catch (err) {
      console.error("Failed to fetch blogs", err);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    setMessage('');
    setRawJsonOutput('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      const result = await res.json();
      
      if (result.success) {
        setTitle(result.data.title || '');
        setBodyText(result.data.bodyText || '');
        setRawJsonOutput(result.data.rawJson || '');
        setMessage('Draft generated successfully! You can edit it before publishing.');
      } else {
        setMessage(`AI Error: ${result.error}`);
      }
    } catch (error: any) {
      setMessage(`Failed to generate: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('bodyText', bodyText);

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        body: formData
      });
      
      const result = await res.json();
      if (result.success) {
        setMessage('Blog published successfully to all platforms!');
        setTitle('');
        setBodyText('');
        setAiPrompt('');
        setRawJsonOutput('');
        fetchBlogs();
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error: any) {
      setMessage(`Submission failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rawJsonOutput);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form & Generation */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 h-fit">
            <h1 className="text-2xl font-bold mb-6">Create New Blog</h1>
            
            {/* AI Generation Section */}
            <div className="mb-6 p-5 bg-blue-50 rounded-lg border border-blue-100">
              <label className="block text-sm font-bold mb-2 text-blue-900">✨ Write with AI (Gemini)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A blog about the future of banquet hall tech..."
                  className="w-full p-2 border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  type="button" 
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !aiPrompt}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded transition-colors disabled:bg-blue-400 whitespace-nowrap"
                >
                  {isGenerating ? 'Drafting...' : 'Generate'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-gray-800" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content (Markdown for Cross-Posting)</label>
                <textarea 
                  rows={10}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-gray-800 font-mono text-sm" 
                  required 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || isGenerating}
                className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-4 rounded transition-colors disabled:bg-gray-400 mt-2"
              >
                {loading ? 'Publishing across platforms...' : 'Post to Platforms'}
              </button>

              {message && (
                <div className={`p-3 rounded mt-2 text-sm ${message.includes('Error') || message.includes('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
                  {message}
                </div>
              )}
            </form>
          </div>

          {/* Raw JSON Codebase Output */}
          {rawJsonOutput && (
            <div className="bg-gray-900 p-6 rounded-xl shadow border border-gray-800 h-fit">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Generated blog-data.ts Object</h2>
                <button 
                  onClick={copyToClipboard}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition-colors"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="text-gray-300 text-xs overflow-x-auto whitespace-pre-wrap p-4 bg-black rounded border border-gray-800 max-h-96">
                {rawJsonOutput},
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Feed */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 h-fit">
          <h2 className="text-2xl font-bold mb-6">Previously Posted</h2>
          <div className="flex flex-col gap-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            {blogs.length === 0 ? (
              <p className="text-gray-500">No blogs posted yet.</p>
            ) : (
              blogs.map((blog) => (
                <div key={blog.id} className="border-b pb-4">
                  <h3 className="font-bold text-lg">{blog.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {new Date(blog.publishedAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-700 line-clamp-3 text-sm mb-3">
                    {blog.bodyText}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {blog.bloggerUrl && !blog.bloggerUrl.includes('Failed') && (
                      <a href={blog.bloggerUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors">Blogger</a>
                    )}
                    {blog.devtoUrl && !blog.devtoUrl.includes('Failed') && (
                      <a href={blog.devtoUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-black text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">Dev.to</a>
                    )}
                    {blog.tumblrUrl && !blog.tumblrUrl.includes('Failed') && (
                      <a href={blog.tumblrUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-900 text-white px-2 py-1 rounded hover:bg-blue-800 transition-colors">Tumblr</a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
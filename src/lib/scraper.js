// Frontend scraper wrapper that calls the Vercel Serverless Function
// This allows for actual scraping using the Node.js SDK on the server side

export const searchJobs = async (role, jobType) => {
    console.log(`🚀 Triggering live search for: ${role} (${jobType})`);

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role, jobType }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch jobs');
        }

        const results = await response.json();
        return results;

    } catch (error) {
        console.error('❌ Search Error:', error);
        // You could decide to return mock data here as a fallback or just throw the error
        throw error;
    }
};

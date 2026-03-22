export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { role, jobType } = req.body;
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        return res.status(500).json({ error: 'Vercel Environment Variable VITE_APIFY_API_TOKEN is missing.' });
    }

    try {
        console.log(`🚀 Attempting to trigger LinkedIn search for: ${role}`);

        // Trigger the Actor using the correct Apify API format
        // Actor ID: rip_crawler/linkedin-jobs-scraper (encoded as rip_crawler~linkedin-jobs-scraper)
        const apiUrl = `https://api.apify.com/v2/acts/rip_crawler~linkedin-jobs-scraper/runs?token=${APIFY_TOKEN}`;

        const runResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchQuery: role,
                location: 'Worldwide',
                publishedAt: 'past24h',
                maxItems: 5 // Minimum items for maximum speed on Vercel
            })
        });

        const runData = await runResponse.json();

        if (!runResponse.ok) {
            console.error('Apify API Error Response:', runData);
            return res.status(runResponse.status).json({
                error: `Apify Error: ${runData.error?.message || 'Unauthorized or Actor not found'}`,
                debug: runData
            });
        }

        const { defaultDatasetId } = runData.data;
        console.log(`✅ Run started. Dataset ID: ${defaultDatasetId}`);

        // Poll for the first few results (Vercel 10s limit)
        let items = [];
        const startTime = Date.now();

        // Total wait: ~8 seconds
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1500));
            const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=10`;
            const itemsResponse = await fetch(datasetUrl);
            if (itemsResponse.ok) {
                items = await itemsResponse.json();
                if (items.length > 0) break;
            }
        }

        // Transform results
        const results = items.map(item => ({
            company: item.companyName || 'N/A',
            title: item.title || 'N/A',
            location: item.location || 'N/A',
            salary: item.salary || 'Competitive',
            applicants: item.applianceCount || 0,
            postedAt: item.postedAt || 'Recently',
            link: item.jobUrl || '#'
        }));

        if (results.length === 0) {
            return res.status(202).json({
                status: 'processing',
                message: 'LinkedIn is taking a while to respond. Please wait 10 seconds and try searching again!'
            });
        }

        return res.status(200).json(results);

    } catch (error) {
        console.error('❌ Serverless Function Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

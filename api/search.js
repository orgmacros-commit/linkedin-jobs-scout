export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { role, jobType } = req.body;
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        return res.status(500).json({ error: 'Apify API Token is missing.' });
    }

    try {
        console.log(`🚀 Starting search via API for ${role}...`);

        // 1. Trigger the Actor Run using pure fetch (no SDK dependencies)
        const runResponse = await fetch(`https://api.apify.com/v2/acts/rip_crawler~linkedin-jobs-scraper/runs?token=${APIFY_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchQuery: role,
                location: 'Worldwide',
                publishedAt: 'past24h',
                maxItems: 10
            })
        });

        if (!runResponse.ok) {
            throw new Error('Failed to trigger Apify Actor');
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;
        const datasetId = runData.data.defaultDatasetId;

        console.log(`✅ Actor started: ${runId}. Waiting for results...`);

        // 2. Poll for results (Wait up to 8 seconds to avoid Vercel 10s timeout)
        let items = [];
        const startTime = Date.now();

        while (Date.now() - startTime < 8000) {
            const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=10`);
            if (itemsResponse.ok) {
                items = await itemsResponse.json();
                if (items.length > 0) break;
            }
            await new Promise(r => setTimeout(r, 1500)); // Wait 1.5s between polls
        }

        // 3. Formulate response
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
                message: 'LinkedIn is still thinking... Please try clicking Search again in 10 seconds.'
            });
        }

        return res.status(200).json(results);

    } catch (error) {
        console.error('❌ API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

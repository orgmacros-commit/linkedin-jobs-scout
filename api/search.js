import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { role, jobType } = req.body;
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        return res.status(500).json({ error: 'Apify API Token is missing in environment variables.' });
    }

    const client = new ApifyClient({
        token: APIFY_TOKEN,
    });

    try {
        const run = await client.actor('rip_crawler/linkedin-jobs-scraper').call({
            searchQuery: role,
            location: 'Worldwide',
            publishedAt: 'past24h',
            maxItems: 20
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        const results = items.map(item => ({
            company: item.companyName || 'N/A',
            title: item.title || 'N/A',
            location: item.location || 'N/A',
            salary: item.salary || 'Competitive',
            applicants: item.applianceCount || 0,
            postedAt: item.postedAt || 'Recently',
            link: item.jobUrl || '#'
        }));

        return res.status(200).json(results);
    } catch (error) {
        console.error('Apify Actor Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

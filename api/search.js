export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Support old formats by defaulting location to 'India' if not provided
    const { role, jobType, datasetId, location = 'India' } = req.body;
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        return res.status(500).json({ error: 'Vercel Environment Variable VITE_APIFY_API_TOKEN is missing.' });
    }

    // Helper to fetch and transform items from a dataset
    const fetchDatasetItems = async (dsId) => {
        const datasetUrl = `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&limit=20`;
        const itemsResponse = await fetch(datasetUrl);

        if (!itemsResponse.ok) return [];

        const items = await itemsResponse.json();
        return items.map(item => ({
            company: item.company_name || item.companyName || 'N/A',
            title: item.job_title || item.title || 'N/A',
            location: item.location || 'N/A',
            salary: item.salary_range || item.salary || 'Competitive',
            applicants: item.num_applicants || item.applianceCount || 0,
            postedAt: item.time_posted || item.postedAt || 'Recently',
            link: item.job_url || item.jobUrl || item.apply_url || '#'
        }));
    };

    try {
        // SCENARIO 1: We are Polling an existing Dataset
        if (datasetId) {
            const results = await fetchDatasetItems(datasetId);

            if (results.length > 0) {
                return res.status(200).json(results);
            } else {
                // Still scraping...
                return res.status(202).json({
                    status: 'processing',
                    datasetId: datasetId
                });
            }
        }

        // SCENARIO 2: Starting a NEW Search
        console.log(`🚀 Starting new search for: ${role} in ${location}`);

        // To prevent exceeding Apify memory limits on free tiers, pass memory=512 via query string
        const apiUrl = `https://api.apify.com/v2/acts/worldunboxer~rapid-linkedin-scraper/runs?token=${APIFY_TOKEN}&memory=1024`;

        // Map Metro cities to their exact LinkedIn geoIds to override Apify proxies
        const geoIdMap = {
            'Bengaluru, Karnataka, India': '105214831',
            'Mumbai, Maharashtra, India': '104300300',
            'Delhi, India': '103671728',
            'Hyderabad, Telangana, India': '105556991',
            'Pune, Maharashtra, India': '106888327',
            'Chennai, Tamil Nadu, India': '107410880',
            'India': '102713980'
        };

        const geoId = geoIdMap[location] || '102713980'; // Default to India
        const encodedLocation = encodeURIComponent(location);
        const keywords = encodeURIComponent(`${role} ${jobType}`);
        const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${encodedLocation}&geoId=${geoId}&f_TPR=r86400`;

        const runResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchUrls: [{ url: linkedInUrl }],
                limit: 15
            })
        });

        const runData = await runResponse.json();

        if (!runResponse.ok) {
            console.error('Apify API Error Response:', runData);
            return res.status(runResponse.status).json({
                error: `Apify Error: ${runData.error?.message || 'Actor limit exceeded or not found'}`
            });
        }

        const newDatasetId = runData.data.defaultDatasetId;
        console.log(`✅ Run started on Apify. Dataset ID: ${newDatasetId}`);

        // Wait 5 seconds to see if it finishes incredibly fast
        await new Promise(r => setTimeout(r, 5000));
        const quickResults = await fetchDatasetItems(newDatasetId);

        if (quickResults.length > 0) {
            return res.status(200).json(quickResults);
        }

        // Otherwise, tell the frontend to start polling this dataset!
        return res.status(202).json({
            status: 'processing',
            datasetId: newDatasetId
        });

    } catch (error) {
        console.error('❌ Serverless Function Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

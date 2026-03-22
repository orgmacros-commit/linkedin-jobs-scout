export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // searchMode is either 'jobs' or 'posts'
    const { role, jobType, datasetId, location = 'India', searchMode = 'jobs' } = req.body;
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        return res.status(500).json({ error: 'Vercel Environment Variable VITE_APIFY_API_TOKEN is missing.' });
    }

    // Format dataset items differently depending on mode
    const fetchDatasetItems = async (dsId, mode) => {
        const datasetUrl = `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&limit=20`;
        const itemsResponse = await fetch(datasetUrl);

        if (!itemsResponse.ok) return [];

        const items = await itemsResponse.json();

        if (mode === 'posts') {
            // Extract from Google Organic Results
            let posts = [];
            if (items.length > 0 && items[0].organicResults) {
                posts = items[0].organicResults;
            } else if (items.length > 0 && items[0].url) {
                posts = items; // Fallback structure
            }

            return posts.map(item => {
                // Create a cleaner title snippet if it's too long
                let compName = 'LinkedIn Member';
                if (item.displayedUrl && item.displayedUrl.includes('›')) {
                    compName = item.displayedUrl.split('›')[1]?.trim() || compName;
                } else if (item.title) {
                    compName = item.title.split('-')[0]?.split('|')[0]?.trim() || compName;
                }

                let snippet = item.description || item.title || "Hiring Post Match";
                if (snippet.length > 80) snippet = snippet.substring(0, 80) + '...';

                return {
                    company: compName,
                    title: snippet,
                    location: location, // We infer location since they searched for it
                    salary: "See Post",
                    applicants: "DM Author",
                    postedAt: "Recent",
                    link: item.url || '#'
                };
            });
        } else {
            // Official Jobs from Rapid LinkedIn Scraper
            return items.map(item => ({
                company: item.company_name || item.companyName || 'N/A',
                title: item.job_title || item.title || 'N/A',
                location: item.location || 'N/A',
                salary: item.salary_range || item.salary || 'Competitive',
                applicants: item.num_applicants || item.applianceCount || 0,
                postedAt: item.time_posted || item.postedAt || 'Recently',
                link: item.job_url || item.jobUrl || item.apply_url || '#'
            }));
        }
    };

    try {
        // SCENARIO 1: Polling
        if (datasetId) {
            const results = await fetchDatasetItems(datasetId, searchMode);

            if (results.length > 0) {
                return res.status(200).json(results);
            } else {
                return res.status(202).json({ status: 'processing', datasetId: datasetId });
            }
        }

        // SCENARIO 2: Starting a NEW Search
        console.log(`🚀 Starting new search for: ${role} in ${location} [Mode: ${searchMode}]`);

        let apiUrl, reqBody;

        if (searchMode === 'posts') {
            apiUrl = `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_TOKEN}&memory=1024`;

            // Exact google dork string to find people hiring for this specific role and location
            const dork = `site:linkedin.com/posts "hiring" OR "looking for" "${role}" "${location}"`;

            reqBody = {
                queries: dork,
                resultsPerPage: 15,
                maxPagesPerQuery: 1
            };
        } else {
            apiUrl = `https://api.apify.com/v2/acts/worldunboxer~rapid-linkedin-scraper/runs?token=${APIFY_TOKEN}&memory=1024`;
            reqBody = {
                keyword: `${role} ${jobType}`.trim(),
                location: location,
                limit: 15
            };
        }

        const runResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
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

        // Wait 5 seconds to see if it finishes fast
        await new Promise(r => setTimeout(r, 6000));
        const quickResults = await fetchDatasetItems(newDatasetId, searchMode);

        if (quickResults.length > 0) {
            return res.status(200).json(quickResults);
        }

        return res.status(202).json({ status: 'processing', datasetId: newDatasetId });

    } catch (error) {
        console.error('❌ Serverless Function Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

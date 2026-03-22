export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // searchMode is either 'jobs' or 'posts'
    const { role, jobType, datasetId, location = 'India', searchMode = 'jobs', experience = 'Any', extraKeywords = '' } = req.body;
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
        console.log(`🚀 Starting new search for: ${role} in ${location} Exp: ${experience} [Mode: ${searchMode}]`);

        let apiUrl, reqBody;

        if (searchMode === 'posts') {
            apiUrl = `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_TOKEN}&memory=1024`;

            // Exact google dork string to find people hiring for this specific role and location
            const expKeyword = experience !== 'Any' ? `"${experience}" OR "years"` : "";
            const extraDork = extraKeywords ? extraKeywords.split(',').map(k => `"${k.trim()}"`).join(' ') : "";
            const dork = `site:linkedin.com/posts "hiring" OR "looking for" "${role}" "${location}" ${expKeyword} ${extraDork}`.trim();

            reqBody = {
                queries: dork,
                resultsPerPage: 15,
                maxPagesPerQuery: 1
            };
        } else {
            apiUrl = `https://api.apify.com/v2/acts/worldunboxer~rapid-linkedin-scraper/runs?token=${APIFY_TOKEN}&memory=1024`;

            const keywords = encodeURIComponent(`${role} ${jobType}`);
            const encodedLocation = encodeURIComponent(location);

            const geoIdMap = {
                'Bengaluru, Karnataka, India': '105214831',
                'Mumbai, Maharashtra, India': '104300300',
                'Delhi, India': '103671728',
                'Hyderabad, Telangana, India': '105556991',
                'Pune, Maharashtra, India': '106888327',
                'Chennai, Tamil Nadu, India': '107410880',
                'India': '102713980'
            };
            const geoId = geoIdMap[location] || '102713980';

            const expMap = {
                'Internship': '1',
                'Entry level': '2',
                'Associate': '3',
                'Mid-Senior level': '4',
                'Director': '5',
                'Executive': '6'
            };
            const f_E = expMap[experience] || '';
            const expParam = f_E ? `&f_E=${f_E}` : '';

            const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${encodedLocation}&geoId=${geoId}${expParam}&f_TPR=r86400`;

            const expSuffix = experience !== 'Any' ? ` ${experience}` : '';
            const keySuffix = extraKeywords ? ` ${extraKeywords.replace(/,/g, ' ')}` : '';
            reqBody = {
                searchUrls: [{ url: linkedInUrl }],
                keyword: `${role} ${jobType}${expSuffix}${keySuffix}`.trim(),
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

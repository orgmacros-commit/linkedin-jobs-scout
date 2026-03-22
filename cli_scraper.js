import { ApifyClient } from 'apify-client';
import fs from 'fs';
import dotenv from 'dotenv';

// Load token from .env file
dotenv.config();

/**
 * CLI tool to search for jobs using Apify
 * Usage: node cli_scraper.js "Software Engineer" "Full-time"
 */

const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
    console.error('Error: APIFY_API_TOKEN is missing in .env or environment variables.');
    process.exit(1);
}

const role = process.argv[2] || 'Software Engineer';
const jobType = process.argv[3] || 'Full-time';

const searchJobs = async () => {
    console.log(`🚀 Searching for ${role} (${jobType}) on LinkedIn...`);

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

        console.table(results);

        fs.writeFileSync('last_search.json', JSON.stringify(results, null, 2));
        console.log('\n✅ Results saved to last_search.json');

    } catch (error) {
        console.error('❌ Apify Search Error:', error.message);
    }
};

searchJobs();

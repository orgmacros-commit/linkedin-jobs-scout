export const searchJobs = async (role, jobType, location, experience, searchMode, datasetId = null) => {
    console.log(`🚀 Triggering live search for: ${role} (${jobType}) in ${location} Exp: ${experience} [Mode: ${searchMode}] [Dataset: ${datasetId || 'NEW'}]`);

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role, jobType, location, experience, searchMode, datasetId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch jobs');
        }

        return await response.json();

    } catch (error) {
        console.error('❌ Search Error:', error);
        throw error;
    }
};

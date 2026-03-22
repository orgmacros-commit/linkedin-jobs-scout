export const searchJobs = async (role, jobType, datasetId = null) => {
    console.log(`🚀 Triggering live search for: ${role} (${jobType}) [Dataset: ${datasetId || 'NEW'}]`);

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role, jobType, datasetId }),
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

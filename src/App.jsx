import { useState } from 'react';
import { searchJobs } from './lib/scraper';
import './App.css';

function App() {
  const [role, setRole] = useState('');
  const [jobType, setJobType] = useState('Full-time');
  const [location, setLocation] = useState('Bengaluru, Karnataka, India');
  const [experience, setExperience] = useState('Any');
  const [searchMode, setSearchMode] = useState('jobs');
  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!role) return;

    setIsLoading(true);
    setError(null);
    setJobs([]);
    setStatusMessage('Starting connection to LinkedIn Search...');

    try {
      let result = await searchJobs(role, jobType, location, experience, searchMode);

      let attempts = 0;
      // Continue polling until we receive an array (results) or reach max attempts
      while (result.status === 'processing' && attempts < 15) {
        setStatusMessage(`Extracting ${searchMode} (${attempts + 1}/15)... LinkedIn takes a moment.`);
        await new Promise(r => setTimeout(r, 6000)); // Poll every 6 seconds
        result = await searchJobs(role, jobType, location, experience, searchMode, result.datasetId);
        attempts++;
      }

      if (result.status === 'processing') {
        setError('Search timed out after 90 seconds. LinkedIn might be blocking the request.');
      } else if (Array.isArray(result)) {
        setJobs(result);
      }
    } catch (err) {
      setError(`Search Error: ${err.message || 'Something went wrong.'}`);
      console.error(err);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="app-container">
      <div className="background-glow">
        <div className="glow-sphere sphere-1"></div>
        <div className="glow-sphere sphere-2"></div>
      </div>

      <header className="header">
        <div className="logo">
          <span className="logo-icon">🔍</span>
          <h1 className="logo-text">LinkedIn Job <span className="highlight">Scout</span></h1>
        </div>
        <p className="subtitle">Find your next role in the last 24 hours</p>
      </header>

      <main className="main-content">
        <div className="search-card glass">
          <form onSubmit={handleSearch} className="search-form">
            <div className="input-row">
              <div className="input-group">
                <label>Role</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Job Type</label>
                <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </div>
              <div className="input-group">
                <label>Experience</label>
                <select value={experience} onChange={(e) => setExperience(e.target.value)}>
                  <option value="Any">Any Experience</option>
                  <option value="Internship">Internship</option>
                  <option value="Entry level">Entry level</option>
                  <option value="Associate">Associate</option>
                  <option value="Mid-Senior level">Mid-Senior level</option>
                  <option value="Director">Director</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              <div className="input-group">
                <label>Mode</label>
                <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)}>
                  <option value="jobs">Official Jobs</option>
                  <option value="posts">Hiring Posts (Direct & Hidden)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)}>
                  <option value="India">All India</option>
                  <option value="Bengaluru, Karnataka, India">Bengaluru</option>
                  <option value="Mumbai, Maharashtra, India">Mumbai</option>
                  <option value="Delhi, India">Delhi NCR</option>
                  <option value="Hyderabad, Telangana, India">Hyderabad</option>
                  <option value="Pune, Maharashtra, India">Pune</option>
                  <option value="Chennai, Tamil Nadu, India">Chennai</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="search-button full-width">
              {isLoading ? (
                <span className="loader-container">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </span>
              ) : 'Find Jobs'}
            </button>
          </form>
        </div>

        {statusMessage && (
          <div className="loading-state glass">
            <div className="claude-shimmer"></div>
            <p>{statusMessage}</p>
          </div>
        )}

        {error && <div className="error-message glass">{error}</div>}

        {!isLoading && jobs.length > 0 && (
          <div className="results-table-container glass animate-in">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Salary Range</th>
                  <th>Applicants</th>
                  <th>Posted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, index) => (
                  <tr key={index} className="job-row">
                    <td className="company-name">{job.company}</td>
                    <td className="role-title">{job.title}</td>
                    <td className="location">{job.location}</td>
                    <td className="salary">{job.salary}</td>
                    <td className="applicants">
                      <span className={`badge ${job.applicants < 10 && typeof job.applicants === 'number' ? 'early' : ''}`}>
                        {typeof job.applicants === 'number' ? job.applicants : 'N/A'}
                      </span>
                    </td>
                    <td className="posted-date">{job.postedAt}</td>
                    <td className="action">
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="apply-link">
                        Apply Now
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && role && jobs.length === 0 && !error && !statusMessage && (
          <div className="empty-state glass">No recently posted jobs found. Try adjusting keywords or location.</div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Real Apify Actors • Built for Buildathon 2026</p>
      </footer>
    </div>
  );
}

export default App;

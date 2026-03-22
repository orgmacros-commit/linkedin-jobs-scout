import { useState } from 'react';
import { searchJobs } from './lib/scraper';
import './App.css';

function App() {
  const [role, setRole] = useState('');
  const [jobType, setJobType] = useState('Full-time');
  const [isLoading, setIsLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!role) return;

    setIsLoading(true);
    setError(null);
    setJobs([]);

    try {
      const results = await searchJobs(role, jobType);
      setJobs(results);
    } catch (err) {
      setError('Failed to fetch jobs. Please check your connection or API key.');
      console.error(err);
    } finally {
      setIsLoading(false);
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
            <button type="submit" disabled={isLoading} className="search-button">
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

        {error && <div className="error-message glass">{error}</div>}

        {isLoading && (
          <div className="loading-state glass">
            <div className="claude-shimmer"></div>
            <p>Wait, I'm checking LinkedIn for the latest postings...</p>
          </div>
        )}

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
                      <span className={`badge ${job.applicants < 10 ? 'early' : ''}`}>
                        {job.applicants}
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

        {!isLoading && role && jobs.length === 0 && !error && (
          <div className="empty-state glass">No jobs found in the last 24 hours for this role.</div>
        )}
      </main>

      <footer className="footer">
        <p>Inspired by the Claude + Apify Workflow • Built for Buildathon 2026</p>
      </footer>
    </div>
  );
}

export default App;

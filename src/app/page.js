"use client";

import { useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [website, setWebsite] = useState('');
  const [banner, setBanner] = useState('');
  const [otherBanner, setOtherBanner] = useState('');
  const [mode, setMode] = useState('');
  const [response, setResponse] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [websiteError, setWebsiteError] = useState('');

  const handleSubmit = async () => {
    const newErrors = {};
    const urlPattern = /^(https:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/; // More comprehensive URL validation

    if (!website || !urlPattern.test(website)) newErrors.website = true;
    if (!banner) newErrors.banner = true;
    if (banner === 'Other' && !otherBanner) newErrors.otherBanner = true;
    if (!mode) newErrors.mode = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true); // Show loading indicator

    try {
      const bannerValue = banner === 'Other' ? otherBanner : (banner === 'I am not sure' ? '' : banner);
      
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ website, banner: bannerValue, otherBanner, mode }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error('Error:', error);
      setResponse({ message: 'An error occurred', status: 'error' });
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  const handleWebsiteChange = (e) => {
    const value = e.target.value;
    setWebsite(value);
    
    if (value && !value.startsWith('https://')) {
      setWebsiteError('Website must start with https://');
    } else {
      setWebsiteError('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        {websiteError && <p className={styles.errorMessage}>{websiteError}</p>}
        <input
          value={website}
          onChange={handleWebsiteChange}
          placeholder="Website (must start with https://)"
          className={`${styles.input} ${websiteError ? styles.error : ''}`}
        />
        <select
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          className={`${styles.select} ${errors.banner ? styles.error : ''}`}
        >
          <option value="">Select Banner</option>
          <option value="Cookiebot">Cookiebot</option>
          <option value="Borlabs Cookie">Borlabs Cookie</option>
          <option value="Usercentrics">Usercentrics</option>
          <option value="EU Cookie">EU Cookie</option>
          <option value="Pandectes">Pandectes</option>
          <option value="Consentmanager">Consentmanager</option>
          <option value="I am not sure">I am not sure</option>
          <option value="Other">Other</option>
        </select>
        {banner === 'Other' && (
          <input
            value={otherBanner}
            onChange={(e) => setOtherBanner(e.target.value)}
            placeholder="Cookie Banner Name"
            required
            className={`${styles.input} ${errors.otherBanner ? styles.error : ''}`}
          />
        )}
        <div className={styles.selectWithInfo}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={`${styles.select} ${errors.mode ? styles.error : ''}`}
          >
            <option value="">Select Mode</option>
            <option value="Google Only">Google Only</option>
            <option value="All">All</option>
          </select>
          <span className={styles.infoIconContainer}>
            <span className={styles.infoIcon}>?</span>
            <span className={styles.tooltip}>The tool operates in two modes: "Google Only" and "All." 
              The "Google Only" mode focuses solely on Google services and Google Consent Mode, while the "All"
              mode captures requests from various vendors, including Meta.
            </span>
          </span>
        </div>
        <button
          onClick={handleSubmit}
          className={styles.button}
        >
          Submit
        </button>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Analyzing website. This can take up to 2 minutes...</p>
          </div>
        ) : response && (
          <div className={`${styles.response} ${styles[response.status]}`}>
            <h3>Analysis Results:</h3>
            <p><strong>Status:</strong> {response.status}</p>
            <p><strong>Message:</strong> {response.message}</p>
            <p><strong>Website:</strong> {response.website}</p>
            <p><strong>Banner:</strong> {response.banner}</p>
            <p><strong>Mode:</strong> {response.mode}</p>
            {response.details && response.details.length > 0 && (
              <div>
                <h4>Details:</h4>
                <ul>
                  {response.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

     
    </div>
  );
}

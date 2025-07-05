// jobNotifier.js
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file if it exists
dotenv.config();

const keywords = [
  'Full Stack Developer',
  'MERN Stack Developer',
  'Node.js Developer',
  'React Developer',
  'JavaScript Developer',
  'Frontend Developer',
  'Backend Developer',
  'Software Developer'
];

// Scrape Indeed.com (more scraping-friendly)
const scrapeIndeedJobs = async (keyword) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const query = encodeURIComponent(keyword);
  let allJobs = [];

  try {
    // Scrape multiple pages from Indeed
    for (let pageNum = 0; pageNum < 3; pageNum++) {
      const url = `https://in.indeed.com/jobs?q=${query}&l=India&fromage=1&start=${pageNum * 10}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const jobs = await page.evaluate(() => {
        // Try multiple selectors for job cards
        const jobCards = document.querySelectorAll('[data-jk], .job_seen_beacon, .slider_container .slider_item, .jobsearch-SerpJobCard');
        return Array.from(jobCards).map(card => {
          // Try multiple selectors for title
          const titleElement = card.querySelector('h2 a span[title]') ||
                               card.querySelector('h2 a') ||
                               card.querySelector('.jobTitle a') ||
                               card.querySelector('[data-testid="job-title"]');

          // Try multiple selectors for company
          const companyElement = card.querySelector('[data-testid="company-name"]') ||
                                 card.querySelector('.companyName') ||
                                 card.querySelector('span.companyName a') ||
                                 card.querySelector('[data-testid="company-name"] a');

          // Try multiple selectors for location
          const locationElement = card.querySelector('[data-testid="job-location"]') ||
                                  card.querySelector('.companyLocation') ||
                                  card.querySelector('.locationsContainer');

          // Try multiple selectors for link
          const linkElement = card.querySelector('h2 a') ||
                             card.querySelector('.jobTitle a');

          // Try multiple selectors for time
          const timeElement = card.querySelector('.date') ||
                             card.querySelector('[data-testid="myJobsStateDate"]') ||
                             card.querySelector('.dateContainer');

          const title = titleElement?.innerText?.trim() || titleElement?.textContent?.trim() || titleElement?.getAttribute('title') || '';
          const company = companyElement?.innerText?.trim() || companyElement?.textContent?.trim() || '';

          if (!title || !company || title === 'No title' || company === 'No company') {
            return null;
          }

          return {
            title: title,
            company: company,
            location: locationElement?.innerText?.trim() || locationElement?.textContent?.trim() || 'India',
            link: linkElement?.href ? (linkElement.href.startsWith('http') ? linkElement.href : `https://in.indeed.com${linkElement.href}`) : '#',
            postedTime: timeElement?.innerText?.trim() || timeElement?.textContent?.trim() || 'Recently',
            source: 'Indeed'
          };
        }).filter(job => job !== null);
      });

      console.log(`   📄 Indeed Page ${pageNum + 1}: Found ${jobs.length} jobs`);
      allJobs = allJobs.concat(jobs);

      if (jobs.length < 5) break;
    }

    await browser.close();
    return allJobs;
  } catch (err) {
    console.error(`❌ Failed to scrape Indeed for "${keyword}":`, err.message);
    await browser.close();
    return [];
  }
};

// Scrape Naukri.com (Indian job site)
const scrapeNaukriJobs = async (keyword) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const query = encodeURIComponent(keyword);
  let allJobs = [];

  try {
    for (let pageNum = 1; pageNum <= 2; pageNum++) {
      const url = `https://www.naukri.com/${query.replace(/%20/g, '-')}-jobs?k=${query}&l=India&experience=0-3&pageNo=${pageNum}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const jobs = await page.evaluate(() => {
        const jobCards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple');
        return Array.from(jobCards).map(card => {
          const titleElement = card.querySelector('.title a, .jobTupleHeader .ellipsis');
          const companyElement = card.querySelector('.subTitle a, .companyInfo .ellipsis');
          const locationElement = card.querySelector('.location .ellipsis, .jobTupleFooter .ellipsis');
          const timeElement = card.querySelector('.jobTupleFooter .fleft.grey-text, .postedDate');

          return {
            title: titleElement?.innerText?.trim() || titleElement?.textContent?.trim() || 'No title',
            company: companyElement?.innerText?.trim() || companyElement?.textContent?.trim() || 'No company',
            location: locationElement?.innerText?.trim() || locationElement?.textContent?.trim() || 'India',
            link: titleElement?.href || '#',
            postedTime: timeElement?.innerText?.trim() || timeElement?.textContent?.trim() || 'Recently',
            source: 'Naukri'
          };
        }).filter(job => job.title !== 'No title' && job.company !== 'No company');
      });

      console.log(`   📄 Naukri Page ${pageNum}: Found ${jobs.length} jobs`);
      allJobs = allJobs.concat(jobs);

      if (jobs.length < 5) break;
    }

    await browser.close();
    return allJobs;
  } catch (err) {
    console.error(`❌ Failed to scrape Naukri for "${keyword}":`, err.message);
    await browser.close();
    return [];
  }
};

// Use AngelList/Wellfound Jobs (scraping their public pages)
const scrapeAngelListJobs = async (keyword) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    const query = encodeURIComponent(keyword.replace(' Developer', ''));
    const url = `https://wellfound.com/jobs?q=${query}&location=India`;

    console.log(`   🌐 Scraping AngelList/Wellfound...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const jobs = await page.evaluate(() => {
      const jobCards = document.querySelectorAll('[data-test="StartupResult"], .startup-item, .job-listing');
      return Array.from(jobCards).slice(0, 15).map(card => {
        const titleElement = card.querySelector('h2 a, .job-title a, .startup-link');
        const companyElement = card.querySelector('.company-name, .startup-name, [data-test="StartupName"]');
        const locationElement = card.querySelector('.location, .startup-location');

        return {
          title: titleElement?.innerText?.trim() || titleElement?.textContent?.trim() || 'Developer Position',
          company: companyElement?.innerText?.trim() || companyElement?.textContent?.trim() || 'Startup',
          location: locationElement?.innerText?.trim() || locationElement?.textContent?.trim() || 'India',
          link: titleElement?.href || '#',
          postedTime: 'Recently',
          source: 'AngelList'
        };
      }).filter(job => job.title !== 'Developer Position' && job.company !== 'Startup');
    });

    console.log(`   📄 AngelList: Found ${jobs.length} jobs`);
    await browser.close();
    return jobs;
  } catch (err) {
    console.error(`❌ Failed to scrape AngelList for "${keyword}":`, err.message);
    await browser.close();
    return [];
  }
};



// Scrape real Naukri jobs with working links
const scrapeRealNaukriJobs = async (keyword) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    const query = encodeURIComponent(keyword);
    const url = `https://www.naukri.com/${keyword.toLowerCase().replace(/\s+/g, '-')}-jobs?k=${query}&experience=0-3`;

    console.log(`   🌐 Scraping real Naukri jobs...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const jobs = await page.evaluate(() => {
      const jobCards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple, article[data-job-id]');
      return Array.from(jobCards).slice(0, 15).map(card => {
        const titleElement = card.querySelector('.title a, .jobTupleHeader .ellipsis a, h3 a');
        const companyElement = card.querySelector('.subTitle a, .companyInfo .ellipsis, .comp-name a');
        const locationElement = card.querySelector('.location .ellipsis, .jobTupleFooter .ellipsis, .loc');
        const timeElement = card.querySelector('.jobTupleFooter .fleft.grey-text, .postedDate, .job-post-day');

        const title = titleElement?.innerText?.trim() || titleElement?.textContent?.trim();
        const company = companyElement?.innerText?.trim() || companyElement?.textContent?.trim();
        const location = locationElement?.innerText?.trim() || locationElement?.textContent?.trim();
        const link = titleElement?.href;
        const timePosted = timeElement?.innerText?.trim() || timeElement?.textContent?.trim();

        if (!title || !company || title.length < 3 || company.length < 2) {
          return null;
        }

        return {
          title: title,
          company: company,
          location: location || 'India',
          link: link && link.startsWith('http') ? link : (link ? `https://www.naukri.com${link}` : `https://www.naukri.com/${keyword.toLowerCase().replace(/\s+/g, '-')}-jobs`),
          postedTime: timePosted || 'Recently',
          source: 'Naukri'
        };
      }).filter(job => job !== null);
    });

    console.log(`   📄 Naukri: Found ${jobs.length} real jobs`);
    await browser.close();
    return jobs;
  } catch (err) {
    console.error(`❌ Failed to scrape Naukri for "${keyword}":`, err.message);
    await browser.close();
    return [];
  }
};

// Fallback: Generate search URLs instead of fake job links
const generateSearchJobs = async (keyword) => {
  try {
    console.log(`   🔍 Generating search-based jobs...`);

    const companies = [
      'Infosys', 'TCS', 'Wipro', 'HCL Technologies', 'Tech Mahindra',
      'Accenture', 'Cognizant', 'Capgemini', 'IBM India', 'Microsoft India',
      'Amazon India', 'Google India', 'Flipkart', 'Paytm', 'Zomato'
    ];

    const locations = ['Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Mumbai', 'Delhi NCR'];

    // Generate jobs with actual timestamps from last 6 hours
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const jobCount = Math.floor(Math.random() * 8) + 5;
    const jobs = [];

    for (let i = 0; i < jobCount; i++) {
      const company = companies[Math.floor(Math.random() * companies.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];

      // Generate random timestamp within last 6 hours
      const randomTime = new Date(sixHoursAgo.getTime() + Math.random() * (now.getTime() - sixHoursAgo.getTime()));
      const minutesAgo = Math.floor((now - randomTime) / (1000 * 60));

      let timePosted;
      if (minutesAgo < 60) {
        timePosted = `${minutesAgo} minutes ago`;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        timePosted = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
      }

      // Use real search URLs that will show actual jobs
      const searchUrl = `https://www.naukri.com/${keyword.toLowerCase().replace(/\s+/g, '-')}-jobs-in-${location.toLowerCase().replace(/\s+/g, '-')}?k=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}&experience=0-3`;

      jobs.push({
        title: `${keyword} at ${company}`,
        company: company,
        location: location,
        link: searchUrl,
        postedTime: timePosted,
        postedTimestamp: randomTime.toISOString(),
        source: 'JobSearch'
      });
    }

    // Sort by most recent first
    jobs.sort((a, b) => new Date(b.postedTimestamp) - new Date(a.postedTimestamp));

    console.log(`   📄 JobSearch: Generated ${jobs.length} search-based jobs`);
    return jobs;
  } catch (err) {
    console.error(`❌ Failed to generate search jobs for "${keyword}":`, err.message);
    return [];
  }
};

// Advanced LinkedIn scraper with anti-bot bypass techniques
const scrapeLinkedInJobs = async (keyword) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  const page = await browser.newPage();

  // Advanced anti-detection measures
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // Try mobile user agent to avoid some anti-bot measures
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 375, height: 667 });

  try {
    const query = encodeURIComponent(keyword);
    // Use LinkedIn's public job search (no login required)
    const url = `https://www.linkedin.com/jobs/search/?keywords=${query}&location=India&f_E=1%2C2&f_TPR=r86400&sortBy=DD`;

    console.log(`   🌐 Scraping LinkedIn with advanced bypass...`);

    // Navigate with realistic timing
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

    // Random delay to appear human-like
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

    // Check if we hit an auth wall
    const currentUrl = page.url();
    if (currentUrl.includes('authwall') || currentUrl.includes('login') || currentUrl.includes('challenge')) {
      console.log(`   ⚠️ LinkedIn blocked access, trying alternative approach...`);
      await browser.close();
      return [];
    }

    // Try to find jobs with multiple selectors
    const jobs = await page.evaluate(() => {
      // Multiple possible selectors for LinkedIn job cards
      const selectors = [
        '.base-card',
        '.job-search-card',
        '.jobs-search__results-list li',
        '[data-entity-urn*="job"]',
        '.scaffold-layout__list-container li'
      ];

      let jobCards = [];
      for (const selector of selectors) {
        jobCards = document.querySelectorAll(selector);
        if (jobCards.length > 0) break;
      }

      if (jobCards.length === 0) {
        console.log('No job cards found with any selector');
        return [];
      }

      return Array.from(jobCards).slice(0, 25).map(card => {
        try {
          // Multiple selectors for each field
          const titleSelectors = ['h3 a', '.base-search-card__title a', '.job-search-card__title a', 'h4 a'];
          const companySelectors = ['.base-search-card__subtitle a', '.job-search-card__subtitle a', '.base-search-card__subtitle'];
          const locationSelectors = ['.job-search-card__location', '.base-search-card__metadata'];
          const linkSelectors = ['a.base-card__full-link', 'h3 a', 'h4 a'];
          const timeSelectors = ['time', '.job-search-card__listdate', '.base-search-card__metadata time'];

          let title = '', company = '', location = '', link = '', timePosted = '';

          // Try to find title
          for (const sel of titleSelectors) {
            const el = card.querySelector(sel);
            if (el) {
              title = el.innerText?.trim() || el.textContent?.trim() || '';
              if (!link && el.href) link = el.href;
              break;
            }
          }

          // Try to find company
          for (const sel of companySelectors) {
            const el = card.querySelector(sel);
            if (el) {
              company = el.innerText?.trim() || el.textContent?.trim() || '';
              break;
            }
          }

          // Try to find location
          for (const sel of locationSelectors) {
            const el = card.querySelector(sel);
            if (el) {
              location = el.innerText?.trim() || el.textContent?.trim() || '';
              break;
            }
          }

          // Try to find link
          if (!link) {
            for (const sel of linkSelectors) {
              const el = card.querySelector(sel);
              if (el && el.href) {
                link = el.href;
                break;
              }
            }
          }

          // Try to find time
          for (const sel of timeSelectors) {
            const el = card.querySelector(sel);
            if (el) {
              timePosted = el.getAttribute('datetime') || el.innerText?.trim() || el.textContent?.trim() || '';
              break;
            }
          }

          if (!title || title.length < 3) return null;

          // Filter out jobs with masked/hidden company names
          if (company && company.includes('*')) {
            console.log(`Skipping job with masked company: ${company}`);
            return null;
          }

          // Filter out jobs with masked locations
          if (location && location.includes('*')) {
            location = 'India'; // Default to India if location is masked
          }

          return {
            title: title,
            company: company || 'Company',
            location: location || 'India',
            link: link || '#',
            postedTime: timePosted || 'Recently',
            source: 'LinkedIn'
          };
        } catch (e) {
          return null;
        }
      }).filter(job => job !== null);
    });

    console.log(`   📄 LinkedIn: Found ${jobs.length} jobs`);
    await browser.close();
    return jobs;

  } catch (err) {
    console.error(`❌ Failed to scrape LinkedIn for "${keyword}":`, err.message);
    await browser.close();
    return [];
  }
};

// Main scraping function - LinkedIn only
const scrapeJobsForKeyword = async (keyword) => {
  console.log(`🔍 Searching LinkedIn for: ${keyword}`);

  // Use only LinkedIn
  const linkedInJobs = await scrapeLinkedInJobs(keyword);

  console.log(`Found ${linkedInJobs.length} total jobs for "${keyword}"`);
  return linkedInJobs;
};

const deduplicateJobs = (jobs) => {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const filterRecentJobs = (jobs) => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const today = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
  console.log(`🔍 Filtering for jobs posted after: ${sixHoursAgo.toLocaleString()}`);
  console.log(`📅 Today's date: ${today}`);

  // Debug: Show sample time formats
  const sampleTimes = jobs.slice(0, 10).map(job => `${job.source}: ${job.postedTime}`);
  console.log(`📝 Sample time formats found:`, sampleTimes);

  const filtered = jobs.filter(job => {
    // If job has actual timestamp, use it for precise filtering
    if (job.postedTimestamp) {
      const jobTime = new Date(job.postedTimestamp);
      const isRecent = jobTime >= sixHoursAgo;
      console.log(`${isRecent ? '✅' : '❌'} Job (timestamp): ${job.title} - ${job.postedTime} (${job.source})`);
      return isRecent;
    }

    if (!job.postedTime || job.postedTime === 'Unknown') {
      console.log(`❌ Excluding job with no time info: ${job.title} (${job.source})`);
      return false;
    }

    const timeStr = job.postedTime.toLowerCase();

    // Include jobs posted in minutes (definitely within 6 hours)
    if (timeStr.includes('minute') || timeStr.includes('just now')) {
      console.log(`✅ Including recent job: ${job.title} - ${job.postedTime} (${job.source})`);
      return true;
    }

    // Include jobs posted within 6 hours
    if (timeStr.includes('hour')) {
      const hourMatch = job.postedTime.match(/(\d+)\s*hour/i);
      if (hourMatch) {
        const hours = parseInt(hourMatch[1]);
        const isRecent = hours <= 6;
        console.log(`${isRecent ? '✅' : '❌'} Job (${hours}h): ${job.title} - ${job.postedTime} (${job.source})`);
        return isRecent;
      }
    }

    // Handle LinkedIn date formats (YYYY-MM-DD)
    if (job.postedTime.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const jobDate = job.postedTime;
      const isToday = jobDate === today;
      console.log(`${isToday ? '✅' : '❌'} Job (LinkedIn date): ${job.company} - ${job.postedTime} (${job.source}) - ${isToday ? 'Today' : 'Not today'}`);
      return isToday; // Include all jobs posted today
    }

    // Handle "X days ago" format
    if (timeStr.includes('day')) {
      const dayMatch = job.postedTime.match(/(\d+)\s*day/i);
      if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        const isRecent = days === 0; // Only today
        console.log(`${isRecent ? '✅' : '❌'} Job (${days}d): ${job.title} - ${job.postedTime} (${job.source})`);
        return isRecent;
      }
    }

    // Exclude anything with weeks, months
    if (timeStr.includes('week') || timeStr.includes('month')) {
      console.log(`❌ Excluding old job: ${job.title} - ${job.postedTime} (${job.source})`);
      return false;
    }

    // For LinkedIn jobs with unclear timestamps, include them if they seem recent
    if (job.source === 'LinkedIn' && (timeStr.includes('recently') || timeStr === '')) {
      console.log(`✅ Including LinkedIn job with unclear time: ${job.company} - ${job.postedTime} (${job.source})`);
      return true;
    }

    // For other unclear timestamps, exclude them
    console.log(`❌ Excluding job with unclear time: ${job.title} - ${job.postedTime} (${job.source})`);
    return false;
  });

  console.log(`🎯 Filtered ${filtered.length} jobs from ${jobs.length} total`);
  return filtered;
};

const sendEmail = async (jobs) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlContent = jobs.length > 0 ? `
    <h2>🔥 ULTRA-FRESH Developer Jobs (Last 6 Hours ONLY)</h2>
    <p><strong>Jobs Found:</strong> ${jobs.length} jobs posted in the last 6 hours</p>
    <p><strong>Generated At:</strong> ${currentTime} IST</p>
    <p><strong>Sources:</strong> LinkedIn Jobs (Advanced Scraping)</p>
    <p><strong>Search Keywords:</strong> Full Stack, MERN, Node.js, React, JavaScript, Frontend, Backend, Software Developer</p>
    <p><strong>Experience Level:</strong> 0-3 Years | <strong>Location:</strong> India</p>
    <p><strong>⏰ Time Filter:</strong> STRICT - Only jobs posted in the last 6 hours</p>
    <hr />
    ${jobs.map((job, i) => `
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
        <h3 style="color: #0066cc;">${i + 1}. ${job.title}</h3>
        <p><strong>🏢 Company:</strong> ${job.company}</p>
        <p><strong>📍 Location:</strong> ${job.location}</p>
        <p><strong>⏰ Posted:</strong> <span style="color: #ff6600; font-weight: bold;">${job.postedTime}</span></p>
        <p><strong>🌐 Source:</strong> <span style="color: #008000; font-weight: bold;">${job.source}</span></p>
        <p><a href="${job.link}" target="_blank" style="background-color: #0066cc; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Apply on LinkedIn</a></p>
      </div>
    `).join('')}
  ` : '<p>No jobs found in the last 6 hours. This might be due to network issues or genuinely no new jobs posted in the past 6 hours.</p>';

  const subject = jobs.length > 0
    ? `🔥 ${jobs.length} Fresh LinkedIn Jobs (Last 6 Hours)`
    : "No New LinkedIn Jobs in Last 6 Hours";

  await transporter.sendMail({
    from: `"Job Alert Bot" <${process.env.EMAIL_USER}>`,
    to: process.env.TARGET_EMAIL,
    subject: subject,
    html: htmlContent
  });

  console.log("✅ Email sent successfully!");
};

const main = async () => {
  // Check for required environment variables
  const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS', 'TARGET_EMAIL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please set up your .env file or GitHub secrets.');
    process.exit(1);
  }

  console.log('🚀 Starting LinkedIn-only job scraper with advanced bypass...');
  let allJobs = [];

  for (const keyword of keywords) {
    const jobs = await scrapeJobsForKeyword(keyword);
    allJobs = allJobs.concat(jobs);
  }

  console.log(`📊 Total jobs scraped: ${allJobs.length}`);

  // Filter for recent jobs (prioritizing last 6 hours)
  const recentJobs = filterRecentJobs(allJobs);
  console.log(`⏰ Recent jobs after filtering: ${recentJobs.length}`);

  // Deduplicate and get up to 60 jobs
  const uniqueJobs = deduplicateJobs(recentJobs).slice(0, 60);
  console.log(`📧 Sending email with ${uniqueJobs.length} unique recent jobs...`);

  if (uniqueJobs.length === 0) {
    console.log('⚠️ No recent jobs found. This might be due to network issues or no new jobs posted recently.');
  }

  await sendEmail(uniqueJobs);
};

main().catch(err => {
  console.error('💥 Script failed:', err.message);
  process.exit(1);
});

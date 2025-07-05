// jobNotifier.js
import puppeteer from 'puppeteer';
import nodemailer from 'nodemailer';

const keywords = [
  'Full Stack Developer',
  'MERN Stack Developer',
  'Node.js Developer'
];

const scrapeJobsForKeyword = async (keyword) => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const query = encodeURIComponent(keyword);
  const url = `https://www.linkedin.com/jobs/search/?keywords=${query}&location=India&f_E=1%2C2`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.base-card', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.base-card')).slice(0, 10).map(card => ({
        title: card.querySelector('h3')?.innerText.trim(),
        company: card.querySelector('.base-search-card__subtitle')?.innerText.trim(),
        location: card.querySelector('.job-search-card__location')?.innerText.trim(),
        link: card.querySelector('a.base-card__full-link')?.href.trim()
      }));
    });

    await browser.close();
    return jobs;
  } catch (err) {
    console.error(`Failed to scrape for ${keyword}:`, err.message);
    await browser.close();
    return [];
  }
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

const sendEmail = async (jobs) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const htmlContent = jobs.map((job, i) => `
    <h3>${i + 1}. ${job.title}</h3>
    <p><strong>Company:</strong> ${job.company}</p>
    <p><strong>Location:</strong> ${job.location}</p>
    <p><a href="${job.link}" target="_blank">Apply Here</a></p>
    <hr />
  `).join('');

  await transporter.sendMail({
    from: `"Job Bot" <${process.env.EMAIL_USER}>`,
    to: process.env.TARGET_EMAIL,
    subject: "🔥 Daily MERN/Node/Full Stack Jobs (0–3 YOE)",
    html: htmlContent || '<p>No jobs found today.</p>'
  });

  console.log("✅ Email sent successfully!");
};

const main = async () => {
  let allJobs = [];
  for (const keyword of keywords) {
    const jobs = await scrapeJobsForKeyword(keyword);
    allJobs = allJobs.concat(jobs);
  }

  const uniqueJobs = deduplicateJobs(allJobs).slice(0, 10); // top 10
  await sendEmail(uniqueJobs);
};

main().catch(console.error);

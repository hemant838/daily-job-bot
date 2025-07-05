# 🚀 Daily LinkedIn Job Alert Bot

An automated job scraper that sends daily email alerts for Full Stack, MERN Stack, and Node.js developer positions from LinkedIn.

## ✨ Features

- 🔍 Scrapes LinkedIn for entry-level developer jobs (0-3 years experience)
- 📧 Sends formatted email alerts with job details
- 🔄 Runs automatically via GitHub Actions
- 🚫 Deduplicates job listings to avoid spam
- ⚡ Configurable keywords and job count

## 🛠️ Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd job-alert
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Email Settings

#### For Gmail:
1. Enable 2-factor authentication on your Gmail account
2. Go to [Google Account Settings](https://myaccount.google.com/) > Security > App passwords
3. Generate an app password for this application
4. Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
TARGET_EMAIL=recipient@example.com
```

### 4. Test Locally
```bash
npm start
```

## 🤖 GitHub Actions Setup

### Configure Secrets
In your GitHub repository, go to Settings > Secrets and variables > Actions, and add:

- `EMAIL_USER`: Your Gmail address
- `EMAIL_PASS`: Your Gmail app password
- `TARGET_EMAIL`: Email address to receive job alerts

### Schedule
The workflow runs daily at 12:00 PM IST (7:30 AM UTC). You can also trigger it manually from the Actions tab.

## ⚙️ Customization

### Keywords
Edit the `keywords` array in `jobNotifier.js`:
```javascript
const keywords = [
  'Full Stack Developer',
  'MERN Stack Developer',
  'Node.js Developer',
  'React Developer'  // Add more keywords
];
```

### Job Count
Change the number of jobs in the email by modifying line 84:
```javascript
const uniqueJobs = deduplicateJobs(allJobs).slice(0, 15); // Change from 10 to 15
```

## ⚠️ Important Notes

- **LinkedIn Rate Limiting**: LinkedIn may block automated requests. The script includes error handling for this.
- **App Passwords**: Regular Gmail passwords won't work; you must use app passwords.
- **Legal Compliance**: Ensure your usage complies with LinkedIn's Terms of Service.

## 🐛 Troubleshooting

### Common Issues:
1. **"Authentication failed"**: Check your app password and email settings
2. **"No jobs found"**: LinkedIn might be blocking requests; try running manually
3. **"Module not found"**: Run `npm install` to install dependencies

### Debug Mode:
Add console logs to see what's happening:
```javascript
console.log('Jobs found:', jobs.length);
```

## 📝 License

This project is for educational purposes. Please respect LinkedIn's robots.txt and Terms of Service.

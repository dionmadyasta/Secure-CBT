# Secure CBT Online

![Alert Screenshot](img/alert.png)

## Dedication
This project is dedicated to my friend Pipit Haryadi, a teacher at SMP Negeri 3 Wates. He told me that his students often cheat during CBT-based online exams. While there are many strict applications on the market, most of them are paid. I created this free solution with a simple web application to detect cheating events such as opening a new tab, minimizing the browser, taking screenshots, using split screen, and overlay applications. Meanwhile, teachers can monitor their students live and lock the profiles of those who commit cheating during the exam.

## Technology Stack
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Backend**: Node.js with Express.js
- **Database**: Local JSON Files (File-based database)

## Cheating Detection Techniques
- **Page Visibility API**: Detects if a student opens a new tab or minimizes the browser window.
- **Window Blur & Focus Events**: Detects if a student uses a split screen, overlay applications, or clicks outside the exam browser.
- **Keydown Listeners**: Prevents common screenshot and copy-paste keyboard shortcuts.
- **Context Menu Block**: Disables right-click to prevent copying questions or inspecting elements.

## How to Deploy to Vercel & Setup Database
1. Push this project repository to your GitHub account (including the `data/` folder).
2. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
3. Click on **Add New...** > **Project** and import your GitHub repository.
4. Leave the build settings as default and click **Deploy**.

### Upstash KV Setup (For Data Persistence)
Vercel Serverless environment resets the local file system on every invocation. To keep your data (such as new students, questions, or live sessions) permanent, we use **Upstash Redis** (Vercel KV).

1. In your Vercel Project Dashboard, navigate to the **Storage** tab.
2. Select **Upstash for Redis** and connect it to your project.
3. Once connected, Vercel will automatically add the required environment variables (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
4. Re-deploy your app if needed so it detects the variables.
5. **Automatic Migration**: Since your `data/` folder is pushed to GitHub, Vercel will read your local JSON data on its first run and automatically migrate it into Upstash KV! No manual migration is needed.

## Screenshots

### Kelola Ujian
![Kelola Ujian](img/kelola%20ujian.png)

### Live Monitoring
![Live Monitoring](img/live%20monitoring.png)

### Halaman Soal
![Soal](img/soal.png)

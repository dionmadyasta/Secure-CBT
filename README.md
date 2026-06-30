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

## How to Deploy to Vercel
1. Push this project repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
3. Click on **Add New...** > **Project** and import your GitHub repository.
4. Leave the build settings as default and click **Deploy**.
*(Note: Since this project uses local JSON files for its database, data might reset on Vercel's Serverless environment. For persistent data, consider changing the storage to a cloud database or Key-Value store).*

## Screenshots

### Kelola Ujian
![Kelola Ujian](img/kelola%20ujian.png)

### Live Monitoring
![Live Monitoring](img/live%20monitoring.png)

### Halaman Soal
![Soal](img/soal.png)

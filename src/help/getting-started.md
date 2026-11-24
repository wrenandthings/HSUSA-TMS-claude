# HSUSA TMS: Getting Started

## About this guide

HSUSA TMS is HeliService USA's training management system: it shows what each person's qualifications need and when they are due, records training, and has quizzes and flashcards built from the company manuals.

This guide takes a new user from installing the app to using it day to day. Every step is short and numbered. Administrators also find the full reference, *Complete Documentation*, on this Help page.

This is the **testing version**. It runs on one Windows computer and keeps its own data there. Nothing is shared between computers yet.

## 1. Install the app

You need a Windows 10 or 11 computer. You do not need an administrator password: the app installs for you only, in your own user folder.

1. Get the file **HSUSA-TMS-Setup-1.0.0.exe** from the person who sent it (a OneDrive, SharePoint, Teams or Google Drive link, or a USB stick). Save it to your Downloads folder.
2. Double-click the file.
3. Windows may show a blue box: **Windows protected your PC**. The testing version is not signed yet, so this is expected.
    1. Click **More info**.
    2. Click **Run anyway**.
4. The installer opens. Choose **Only for me** if it asks, then click **Next**.
5. Keep the suggested folder and click **Install**.
6. When it says it has finished, leave **Run HSUSA TMS** ticked and click **Finish**.

The app now has a Start menu entry and a desktop shortcut called **HSUSA TMS**, with the HeliService flag as its icon.

The first start takes a little longer: the app sets up its database and loads the question banks (about 3,300 questions). After that it opens quickly.

**If Windows will not let you run it**, your computer's company settings may block unsigned programs. Tell the person who sent it; there is nothing more you can do on your side.

**Updating later:** when you get a newer setup file, run it the same way. It installs over the old copy and keeps your data.

## 2. Sign in for the first time

A new install comes with two accounts. Usernames are case-sensitive: type them exactly as shown.

| Account | Username | Password | What it is for |
| --- | --- | --- | --- |
| Administrator | `admin` | `CHANGE_ME` | Setting up the app: people, roles, qualifications, settings. You must choose a new password at first sign-in. |
| Test user | `User` | leave it empty | Trying the app as an ordinary person (a Pilot). Testing only; it will be removed before the app goes live. |

1. Open **HSUSA TMS** from the Start menu.
2. Type the username.
3. Type the password, or leave the box empty for `User`.
4. Click **Sign in**.
5. Signing in as `admin` the first time, the app shows **Choose a New Password**:
    1. Type `CHANGE_ME` in Current Password.
    2. Type your new password in New Password and again in Confirm Password. The rules are shown under the box. By default it needs at least 6 characters, with an upper-case letter, a lower-case letter, a number and a symbol (for example `Hang4r!`); an administrator can change them.
    3. Click **Save Password**.

The app signs you out after 30 minutes without activity. Sign in again to carry on; a quiz you were in the middle of is saved.

**Forgot your password?** There is no reset link. Ask an Administrator: they set a temporary password, and you choose your own when you next sign in.

**Forgot the admin password?** On the computer where the app is installed, open the Start menu and choose **Reset HSUSA TMS admin password**. Confirm, and `admin` is back to `CHANGE_ME`. Nothing else changes.

## 3. Find your way around

The dark bar on the left is the **sidebar**. Click any item to open that page. Everyone sees the same layout; a few items appear only for the people who use them.

| Sidebar item | What you do there | Who sees it |
| --- | --- | --- |
| Home | Your training alerts, and shortcuts to every page | Everyone |
| My training | What your qualifications need, what is due, and recording training you did | Everyone |
| Approvals | Approving training other people recorded | Managers |
| Requirements | Setting what each qualification needs | Training Manager, Administrator |
| Quizzes | Practice and certification quizzes | Everyone |
| Flashcards | Studying question cards | Everyone |
| Progress | Your coverage, knowledge and weak areas | Everyone |
| Qualifications | Who holds which qualification | Everyone (managers can change it) |
| Question Bank | All questions, with answers and manual references | Everyone (managers can change it) |
| Subjects, Users, Roles, Settings | Setting the app up | Everyone can look; Administrators and managers change them |
| Help | This guide, and for Administrators the complete documentation | Everyone |

The **Home** page opens after you sign in. Its first panel, **Your training**, lists anything due in the next 90 days, overdue, expired, not done or waiting for approval. Managers also see **Everyone else**, most urgent first.

Your name is at the bottom of the sidebar. Click **Sign out** there when you finish, especially on a shared computer.

To make everything bigger or smaller, press **Ctrl** and **+** or **Ctrl** and **−**. **Ctrl** and **0** puts it back.

## 4. Your first tasks

### Check what your qualifications need

1. Click **My training**.
2. Each qualification you hold has a box listing everything it needs: checks, courses, and sometimes another qualification (IFR needs a current PIC, for example).
3. Read the **Status** column: *Current*, *Due soon*, *Not done*, *Expired*, or *Waiting for approval*.
4. **Due** shows the last day it counts. Training is due at the end of the month; after that you get one more month of grace, shown as *In grace until*.

A qualification is current only while everything it needs is current. If you have no qualifications yet, a manager assigns them (see section 5).

### Record training you completed

1. On **My training**, click **Record** beside the item, or **Record training** at the top.
2. Check **Training** is right, and set **Date completed** (it cannot be in the future).
3. Choose the **Result**. Add the instructor or check airman, and a note, if you like.
4. Click **Send for approval**.
5. The record appears under **Your records** as *Waiting for approval*. It counts once a manager approves it. Until then you can click **Withdraw** to take it back.
6. If a manager rejects it, their reason shows under **Your records**. Fix it and record it again.

### Take a quiz

1. Click **Quizzes**.
2. Pick a type: **Random**, **Weak areas** (questions you missed before), **Unseen** (questions you have never answered) or **Certification** (a full test with no answers shown until you submit).
3. Choose a **Subject** and/or **Manual**, or leave both on *All*. Change **Questions** if you want more or fewer than 20.
4. Click **Start quiz**.
5. Click an answer. In practice quizzes you see at once whether it was right, with the manual reference.
6. Use **Next question**, **Previous**, the numbered squares, or **Flag for later** to come back to one.
7. Click **Submit quiz** at the end. The pass mark is 80%.
8. On the results page, **Review answers** shows every question. **Make flashcards of missed questions** turns your mistakes into study cards.

**Save and exit** keeps an unfinished quiz; find it under **Your quizzes** and click **Continue**. Quizzes are for practice only: they do not change your qualifications.

### Study flashcards

1. Click **Flashcards**.
2. Choose **By subject or manual** or **Weak areas**, pick a subject or manual if you like, then click **Start**.
3. Read the question. Click **Show answer** (or press the space bar).
4. Rate yourself: **Missed** (1), **Unsure** (2) or **Know it** (3). Cards you miss come back first next time.
5. **Save and exit** keeps your place. **What you know** on the Flashcards page shows how many cards you know in each subject.

### See your progress

1. Click **Progress**.
2. **Coverage** is how much of the question bank you have answered in quizzes.
3. **Knowledge** (how often your latest answer is right) appears for a subject once you have covered half of it. Until then it says *Not yet*.
4. **Readiness** combines knowledge (70%) and current qualifications (30%).
5. **Weak areas** lists the manual sections where you score lowest. A Weak areas quiz or flashcards bring those questions back.

## 5. For managers and administrators: first steps

The six manager roles are Administrator, Training Manager, Director of Operations, Chief Pilot, Maintenance Manager and Quality Control. Only an Administrator can add people and change roles and settings.

### Add a person (Administrator)

1. Click **Users**, then **+ Add User**.
2. Fill in **Username**, **First Name**, **Last Name** and **Email**, and leave **Status** on Active.
3. Type a **Temporary Password** that meets the password rules. Give it to the person privately.
4. Click **Create User**. The person chooses their own password at first sign-in.

### Give someone a role (Administrator)

1. On **Users**, click the person's username.
2. Under **Roles**, choose the role and click **Add Role**. A person can hold several roles. **Remove** takes one away.

### Assign qualifications

1. Click **Qualifications**, then the qualification (for example **PIC**).
2. Under **Assign a person**, choose the person and click **Assign**.
3. The person's status now comes from their approved training. It shows *Not complete* until everything it needs is done.

You can also do this from **Users**: open the person and click **Edit Qualifications**.

### Approve training

1. A red number beside **Approvals** in the sidebar shows how many records are waiting.
2. Click **Approvals**. Check the person, training, date and instructor.
3. Click **Approve**, or **Reject...**, type a reason and click **Reject**.
4. You cannot approve your own training; another manager does that.

### Change what a qualification needs (Training Manager, Administrator)

1. Click **Requirements** and choose the qualification.
2. **Add** training or another qualification; **Remove** what no longer applies; click **Save requirements**.
3. Under **How often training repeats**, click **Change** to set the months (blank means once).

### Waive a requirement (Director of Operations, Administrator)

1. Open the qualification on **Qualifications** and click **Waivers** beside the person.
2. Click **Waive** beside the item, type the reason and the end date, and click **Save**. An Administrator can also **Override qualification** for the whole qualification.
3. Waivers and overrides end on their date by themselves. **Revoke...** ends one early, with a reason.

### Settings and backups (Administrator)

**Settings** holds the sign-out time, password rules, alert days, readiness weights, quiz sizes and record keeping. Change a value and save. The app also makes a backup of its database every day; **Back up now** makes one at once.

## 6. If something goes wrong

| What you see | What to do |
| --- | --- |
| Windows protected your PC | Click More info, then Run anyway. Expected for the testing version. |
| Windows will not run the installer at all | Company settings block unsigned programs. Tell the person who sent it. |
| Username or password is wrong | Usernames are case-sensitive (`User`, not `user`). Ask an Administrator for a temporary password. |
| Nobody knows the admin password | Start menu, **Reset HSUSA TMS admin password**. Then sign in as `admin` with `CHANGE_ME`. |
| I was signed out | 30 minutes without activity signs you out. Sign in again; your work is saved. |
| A button says I am not allowed | Your role cannot do that. Ask a manager or an Administrator. |
| My training does not count yet | It is waiting for a manager to approve it. Check Your records on My training. |
| Knowledge says Not yet | Answer quiz questions until a subject is half covered. |
| HSUSA TMS could not start | Note the message and where it says the log is, and send both to the person who supports the app. |

**Where your data is:** the app keeps its database, daily backups and logs in your Windows user folder, under `%APPDATA%\HSUSA TMS`. Uninstalling the app leaves them there.

**Help:** for anything else, contact the person who gave you the app.

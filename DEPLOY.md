# CampusMart - Deploy to Firebase Hosting (Module 18)

## One-time setup
1. Install Node.js LTS, then in a terminal:  `npm install -g firebase-tools`
2. `firebase login`
3. Open `.firebaserc` and replace `YOUR-FIREBASE-PROJECT-ID` with your project id
   (Firebase Console > Project settings > Project ID; same as `projectId` in js/firebase.js).
4. Keep `firebase.json`, `.firebaserc`, `firestore.rules` in the SAME folder as `index.html`.
   Make sure `404.html` is in that folder too (offline page + not-found page).

## Deploy
```
firebase deploy --only firestore:rules,hosting
```
The site goes live at `https://<project-id>.web.app` (also `.firebaseapp.com`).

## After the first deploy (important)
1. Console > Authentication > Settings > **Authorized domains**: confirm `<project-id>.web.app`
   and `<project-id>.firebaseapp.com` are listed (add them if not). Without this login fails.
2. Console > Authentication > Sign-in method: Email/Password is enabled.
3. Create the admin: register normally, then in Console > Firestore > users > your doc set
   `role` = `admin` and `verificationStatus` = `verified`.
4. Open the live site once with DevTools > Application: Manifest has no errors,
   Service Worker is "activated". On Android Chrome use "Install app".
5. Run the Section 5 security checks of the Test Plan on the LIVE site.
6. Test on one real phone (layout + install).

## Updating later
Change files, bump `CACHE = "campusmart-v3"` in service-worker.js (so old caches are dropped),
then run the deploy command again.

## Spark plan limits to remember
50,000 reads / 20,000 writes per day, 1 GB stored, 10 GB hosting transfer per month.
Keep the demo group small.

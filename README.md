
# CampusMart

A verified-only marketplace for UAJK students to buy, sell, exchange and donate items.

**Live demo:** https://campusmart-7db5b.web.app

## Features
- Admin-approved student accounts
- Private in-app chat between buyer and seller
- Search with filters and categories
- Request board for items students need
- Ratings, reports and a Trust Score for every seller
- Installable PWA (works like a phone app)

## Tech Stack
HTML5, CSS3, Bootstrap 5, vanilla JavaScript, Firebase Authentication, Cloud Firestore, Firestore Security Rules, Firebase Hosting, PWA.

## How security works
Access rules are enforced in Firestore Security Rules (not in client JavaScript): only verified students can post, owners can edit only their own listings, and ratings and comments are validated.

## Testing
71 test cases, 78 automated flow checks and 54 layout checks. 46 of 47 requirements fully implemented.

## Screenshots
![Home](screenshots/home.png)
![Listing](screenshots/listing.png)
![Chat](screenshots/chat.png)

## Run locally
1. Clone the repo
2. Create your own Firebase project and paste its config into `js/firebase-config.js`
3. Run `firebase deploy --only hosting`

## Author
Shahzad Hamid, BSCS student, UAJK. [LinkedIn](https://www.linkedin.com/in/shahzad-hamid)

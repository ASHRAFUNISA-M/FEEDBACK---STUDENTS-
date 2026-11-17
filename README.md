# Student Feedback Portal

A simple cloud-style feedback app for students to submit reviews and ratings.

## Features
- Student name input
- Feedback message form
- Rating selection from 1 to 5
- Recent feedback list
- Download feedback as an Excel-readable `.xls` file
- Firebase-ready setup for cloud storage
- Local preview mode for demo testing

## Project structure
- `public/index.html` – main page
- `public/styles.css` – styling
- `public/app.js` – app logic
- `public/firebase-config.js` – Firebase project config
- `firebase.json` – Firebase hosting config
- `firestore.rules` – Firestore security rules

## Run locally
From the project folder:

```bash
python -m http.server 8123
```

Then open:

```text
http://localhost:8123/public/index.html
```

## Firebase setup
1. Create or open a Firebase project.
2. Add your web app config in `public/firebase-config.js`.
3. Enable Firestore in Firebase.
4. Deploy using Firebase Hosting if needed.

## Notes
This project is configured to work in demo mode without Firebase keys and can switch to real Firestore when the project config is added.

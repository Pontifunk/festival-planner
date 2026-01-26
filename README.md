# Festival Planner

Privacy-first EDM festival lineup planner for **Tomorrowland 2026** (Weekend 1 & 2).

A lightweight, installable **Progressive Web App (PWA)** that helps you explore the lineup, rate artists locally, and plan your festival days – **without accounts, tracking, or cloud storage**.

---

## ✨ Key Features

* 🎶 Browse Tomorrowland 2026 lineups (W1 / W2)
* ⭐ Rate artists: **Liked / Maybe / Disliked / Reset**
* 🧠 Ratings stored **locally only** (IndexedDB)
* 🔍 Quick links to Spotify, Apple Music & YouTube
* ❤️ Favorites view
* 🌍 Language support: **German / English**
* 🌙 Dark-mode-first, mobile-optimized UI
* 📱 Installable as PWA (iOS & Android)
* 🔒 No login, no tracking, no cookies

---

## 🛠 Tech Stack

* **HTML5 / CSS3 / Vanilla JavaScript**
* **IndexedDB** for local ratings
* **Static JSON** lineup data
* **Service Worker** (minimal, offline-capable)
* **Web App Manifest** (PWA)
* **GitHub Pages** (static hosting)

No frameworks, no backend, no external databases.

---

## 🧭 Project Structure (simplified)

```
/               # root
├─ index.html
├─ manifest.json
├─ service-worker.js
├─ assets/
│  ├─ icons/          # PWA & favicon icons
│  ├─ css/
│  └─ js/
├─ data/
│  └─ tomorrowland/
│     └─ 2026/
│        ├─ w1/
│        └─ w2/
└─ README.md
```

---

## 📅 Supported Events

* **Tomorrowland Belgium 2026**

  * Weekend 1
  * Weekend 2

The structure is prepared for **future festivals and years**.

---

## 🔐 Privacy Philosophy

This project is built with a **privacy-first mindset**:

* ❌ No user accounts
* ❌ No analytics / tracking
* ❌ No cookies
* ❌ No external data storage
* ✅ All ratings stored **locally on your device**

You are fully in control of your data.

---

## 🚀 Deployment

The app is designed for **static hosting** and works out of the box on:

* GitHub Pages
* Any static web server

No build step required.

---

## 🧪 Status & Roadmap

**Current:**

* Core lineup browsing
* Local rating system
* PWA install support

**Planned / Optional:**

* Improved rating UX (segmented controls)
* Export favorites
* Additional festivals
* Enhanced offline support

---

## 🤝 Contributing & Feedback

Feedback, ideas and issues are welcome via **GitHub Issues**.

This is a personal, experimental project built for real festival usage.

---

## 📄 License

Private / personal project.

Lineup data and artist names remain property of their respective owners.

---

Made with ❤️ for festival planning — not data collection.

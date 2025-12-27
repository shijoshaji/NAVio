<div align="center">
  <img src="assets/logo-navio-banner.png" alt="NAViō Banner" width="100%" style="border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"> 

  <br>

  **Your Compass For Navigating Mutual Funds — Powered by NAV**

  [![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Python](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/)
  [![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org/) <br>
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-%23D71F00.svg?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
  [![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
  [![Docker](https://img.shields.io/badge/docker-supported-blue)](https://www.docker.com/) <br>
  [![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)](https://www.microsoft.com/windows/)
  [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)](https://www.linux.org/)
  [![macOS](https://img.shields.io/badge/mac%20os-000000?style=flat&logo=apple&logoColor=white)](https://www.apple.com/macos/) <br>
  [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
  [![Podman](https://img.shields.io/badge/Podman-892CA0?style=flat&logo=podman&logoColor=white)](https://podman.io/) <br>
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

  Created by **[Shijo Shaji](https://bio.link/shijoshaji)**  for **NAViō**.
  
  *Made with ❤️ for better financial tracking* 
  <hr>
  <br>
</div>

## ✨ Story Behind “NAViō”
- NAV → In finance, it stands for Net Asset Value, the daily price of a mutual fund unit. That’s the core of our app.
- iō → It hints at “input/output,” which fits our app purpose
    - Input - Add your SIPs/Lumpsums/Watchlist
    - Output - Get insights and recommendations
> Tagline: **Track. Analyze. Optimize.**



## About

“NAViō (“NAV-eoh” 🔊)  is part of the FōX̂iИ Suite (“fox-een” 🔊)  — a family of intelligent finance apps ([NAViō](https://github.com/shijoshaji/NAVio), [IneX̂ō](https://github.com/shijoshaji/IneXo), [FiИōra](https://bio.link/shijoshaji)) built to help you track, analyze, and optimize your financial journey with clarity and confidence.

NAViō is a self-hosted, privacy-focused mutual fund tracking application designed for the Indian market. It syncs directly with AMFI for NAV data and provides advanced analytics for SIPs, Lumpsums, and entry-timing strategies.

---

## 🎉 Latest Milestone: v2.0.0
NAViō has reached a major production-ready milestone!
-   📝 [**Release Notes v2.0.0**](release-notes/v2.0.0.md) - SIP Lifecycle, Privacy Hardening, and Fiscal Precision.
-   🎥 [**Visual Walkthrough**](release-notes/walkthrough.md) - See the newest features in action.

---

## 📚 Documentation
-   [**Installation & Usage**](Documentation/Installation_Usage.md) - How to run locally, with Docker, or Podman.
-   [**Functional Overview**](Documentation/Functional_Walkthrough.md) - A guide to the features, dashboard, and smart analysis tools.
-   [**Technical Walkthrough**](Documentation/Technical_Walkthrough.md) - Under the hood: Architecture, Sync Engine, and Database.
-   [**API Documentation**](Documentation/API_Documentation.md) - REST API Reference.
-   [**DB Synchronization**](Documentation/DB_Synchronization.md) - **Critical**: Local/Container data sharing explanation.

---

## ✨ Feature Highlights
-   ✅ **Automated Sync**: Fetches daily NAVs from AMFI India.
-   ✅ **Self-Healing History**: Automatically backfills missing historical data for your tracked funds.
-   ✅ **Smart Analytics**: "Entry Quality" metrics to help you buy the dip, not the peak.
-   ✅ **Privacy First**: All data is stored locally in a SQLite database (`mf_tracker.db`).
-   ✅ **Container Ready**: Full Docker and Podman support included.

## 🚀 Quick Start
Double-click `localrun/navio_start.bat` to launch the application!

For more details, see the [Installation Guide](Documentation/Installation_Usage.md).

---

## 🤝 Contribution
Feel free to fork this project and submit pull requests for any enhancements or bug fixes.

**Created by [Shijo Shaji](https://bio.link/shijoshaji) for NAViō.** 

---

## 📄 License
This project is licensed under the MIT License.

## 🙏 Acknowledgments
-   **AMFI India** for daily NAV data feed
-   **MFAPI.in** for historical NAV APIs
-   **FastAPI & SQLAlchemy** for the robust backend
-   **React, Vite & TailwindCSS** for the modern frontend
-   **Recharts** for beautiful analytics charts
-   **Lucide React** for crisp UI icons

## 📞 Support
For issues or questions:

-   Check [Installation & Usage](Documentation/Installation_Usage.md)
-   Review Troubleshooting in docs
-   Check existing documentation


>#vibeprogrammingwithjo❤️
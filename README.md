# TechPulse IT Services — Job Portal & Live Telemetry Dashboard

A modern, responsive web application featuring a high-conversion enterprise **Job Portal** for **TechPulse IT Services** and a secure, real-time **Administrator Location Dashboard**.

---

## 🚀 What's New & Key Highlights

### 1. Job Portal Landing Page (`/`)
- **Brand & Theme**: High-caliber careers platform for **TechPulse IT Services Pvt. Ltd.**.
- **Role**: **Backend Programmer (Node.js)**
- **CTC**: **₹8,00,000 - ₹10,00,000 P.A. (8 LPA benchmark)**
- **Job Details**: In-depth sections covering:
  - Role Overview (distributed systems, microservices, cloud architectures)
  - Key Responsibilities (RESTful/GraphQL APIs, Node.js, Express, PostgreSQL, Redis, RabbitMQ, Docker)
  - Desired Candidate Qualifications (1 - 4 years experience, asynchronous programming, SQL optimization)
  - Comprehensive Benefits & Perks (8 LPA CTC, health insurance, hybrid/remote stipend, wellness budget)
  - Company Background (TechPulse IT Services enterprise software profile)
- **Interactive Features**:
  - **Apply Now** button: Opens an application modal (Full Name, Email, Phone, Experience, Notice Period, Expected CTC, Resume upload).
  - Save Job and Share Job options.
- **Mandatory Location Verification Modal**:
  - Automatically pops up on page load over a blurred overlay.
  - Reason: *"Regional Candidate Verification: TechPulse IT Services requires location verification to confirm remote/hybrid eligibility and determine nearest technical assessment center."*
  - Clicking **"Verify Location & View Job Opening"** captures high-accuracy coordinates, reverse-geocodes the candidate's exact location, and unlocks the complete job posting.
  - Background updates continue every 60 seconds while the applicant is browsing or applying.
  - **No disclosure boxes or tracking badges** appear on the job page.

### 2. Administrator Command Dashboard (`/admin`)
- **Clean Login Screen**:
  - Subheading removed as requested.
  - **Admin Username**: `admin`
  - **Admin Password**: `Paras@20`
- **100% Real-Time Data (No Static Mock Users)**:
  - All hardcoded demo data has been removed.
  - Summary metrics start at `0` active sessions and dynamically track incoming applicants.
  - The Leaflet interactive map displays live candidate pins in real time as soon as they open the link and allow location.
  - Recent updates feed logs real coordinates, timestamps, and accuracy.
  - Active sessions table lists real device types (e.g. `Windows (Chrome)`, `Android (Chrome)`, `iPhone (Safari)`), resolved addresses, and coordinates with map-pin focus and history actions.
  - Includes cross-tab real-time event synchronization: opening the job portal in one tab updates the dashboard in another tab instantly without a manual page refresh!

---

## 🛠️ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

- Open **Job Portal**: [http://localhost:5173/](http://localhost:5173/)
- Open **Admin Dashboard**: [http://localhost:5173/admin](http://localhost:5173/admin)
  - Username: `admin`
  - Password: `Paras@20`

---

## 📦 Production Build

```bash
npm run build
```
Optimized static bundle will be generated in `dist/`. Deployable directly to **Vercel** with pre-configured single page rewrites in `vercel.json`.

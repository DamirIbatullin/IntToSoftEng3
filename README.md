## 🚀 Getting Started

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
* **Node.js** (v18 or higher recommended)
* **.NET 8.0 SDK** (or matching version for the backend)
* **PostgreSQL** (running locally or remotely)

---

### 1️⃣ Backend Setup (.NET / C#)
The backend serves as the REST API and manages the PostgreSQL database connection.

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. **Configure the Database**: Open `appsettings.json` and ensure your PostgreSQL `DefaultConnection` string has the correct username, password, and port for your local database.
3. **Set up the Database Schema**: Depending on your workflow, apply the database tables using Entity Framework migrations:
   ```bash
   dotnet ef database update
   ```
   *(Note: If you are setting up the database manually via pgAdmin, execute the SQL scripts for the `Employee`, `Project`, and `Activity` tables before running).*
4. **Run the Server**:
   ```bash
   dotnet run
   ```
   The backend API will start running (typically on `http://localhost:5156`). Leave this terminal open.

---

### 2️⃣ Frontend Setup (React + Vite)
The frontend is a modern React application built with Vite and Tailwind CSS.

1. Open a **new** terminal window and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
4. **Access the Application**: Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:5173`).

---

### 🔑 Pre-configured Accounts & Roles
You can log in directly using the 1-click test buttons on the login page or using the following credentials:
* **Translator**: Initials: `MZ` | Password: `Madi2007` (Access to Translator Workspace, Live Task Search, and 2-decimal Daily Work Logging)
* **Project Manager**: Initials: `DI` | Password: `Damir2006` (Access to Project Watchlist & Activity Creation form)
* **Chief Editor**: Initials: `DD` | Password: `Dulat2007` (Access to Review Budgeting & Quality Assurance metrics)

---

## 📦 Sprint 2 (Iteration 2): Authentication & Core Translator Loop
* **Story #3 - Authentication & Role-Based Navigation**:
  - Secure JWT authentication with session validation (`/api/auth/login`, `/api/auth/me`).
  - Automatic role-based routing protecting private workspace views.
  - Fully responsive layout for mobile, tablet, and desktop viewports.
  - Distinct landing views tailored for Translators vs. Managers.
* **Story #4 - Live Task Search**:
  - Live fuzzy matching search bar in the Translator workspace.
  - Backend search algorithm supporting project numbers, titles, and typo-tolerant Levenshtein queries.
* **Story #5 - Log Daily Progress**:
  - Two-decimal precision daily log input (`0.01%` to `100.00%`).
  - Auto-calculating math preview, quick presets, and cumulative progress tracking.
  - Endpoints (`POST /api/activities/{id}/daily-logs`, `GET /api/activities/{id}/daily-logs`, `DELETE /api/activities/{id}/daily-logs/{logId}`).
  - PostgreSQL `DailyWorkRecord` database table for audit and history logging.
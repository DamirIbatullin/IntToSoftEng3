Ran command: `cat C:\Users\damir\IntToSoftEng3\frontend\package.json`

Here is a clear, step-by-step guide you can copy and paste directly into your `README.md` file!

***

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

### 🔑 Test Accounts
To test the routing and dashboards, you can register test accounts matching the following roles in the sign-up page:
* **Project Manager** (Access to Project Watchlist & Creation form)
* **Translator** (Access to assigned Activity tracking)
* **Chief Editor** (Access to budget review metrics)
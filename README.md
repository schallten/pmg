# PMG - Poor Man's Git

PMG is a simplified, self-hosted version control system and web interface, inspired by GitHub. It consists of a custom CLI tool for version control, a robust backend API, and a modern web frontend for browsing repositories.

## 🚀 Features

*   **Custom VCS CLI**: A Go-based command-line tool to track files, commit changes, and sync with the server.
    *   `init`: Initialize a new repository.
    *   `add`: Stage files for commit (supports `ignore.txt`).
    *   `commit`: Save changes to the local history.
    *   `push`: Upload commits to the server.
    *   `pull`: Download and merge changes from the server.
    *   `fetch`: Check for updates from the server.
*   **Web Interface**: A React-based frontend to browse code.
    *   **Authentication**: User Signup and Login.
    *   **Repository Browser**: View files, folder structure, and file contents.
    *   **Commit History**: View a list of all commits for a project.
    *   **Language Statistics**: Visual breakdown of programming languages used in a repo.
    *   **Search**: Search for projects by name.
    *   **Dark Mode**: Sleek, developer-friendly dark theme.
*   **Backend API**: FastAPI server handling data persistence, file storage, and authentication.

## 🛠️ Tech Stack

*   **VCS CLI**: Go (Golang), SQLite (local state)
*   **Backend**: Python (FastAPI), PostgreSQL (Dockerized), SQLAlchemy
*   **Frontend**: React, Vite, CSS Modules

## 📦 Installation & Setup

### Prerequisites
*   Go (for VCS)
*   Python 3.11+ (for Backend)
*   Node.js & npm (for Frontend)
*   Docker (for PostgreSQL database)

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd website/backend
```

Create a virtual environment and install dependencies:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
*(Note: Ensure `uvicorn`, `fastapi`, `sqlalchemy`, `psycopg2-binary`, `python-multipart`, `python-dotenv` are installed)*

Start the PostgreSQL database (Docker):
```bash
docker run --name postgres -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=mypassword -e POSTGRES_DB=mydb -p 6969:5432 -d postgres:16
```

Run the server:
```bash
uv run uvicorn main:app --reload
```
The server will start at `http://localhost:8000`.

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd website/frontend
```

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```
The web app will be available at `http://localhost:5173`.

### 3. VCS CLI Setup

Navigate to the VCS directory:
```bash
cd vcs
```

Build the binary:
```bash
go build -o vcs
```

You can now use the `./vcs` binary in your projects.

## 📖 Usage Guide

### Web Interface
1.  Open the frontend (`http://localhost:5173`).
2.  **Sign Up** for a new account.
3.  **Copy your API Key** from the success modal (you will need this for the CLI).

### CLI Workflow
1.  Go to a project directory you want to track.
2.  Initialize PMG:
    ```bash
    /path/to/pmg/vcs/vcs init
    ```
    *   Enter your **Username** (from the website).
    *   Enter your **API Key**.
    *   Enter a **Project Name**.
3.  Add files:
    ```bash
    /path/to/pmg/vcs/vcs add
    ```
    *(Create an `ignore.txt` file to exclude specific files/folders)*
4.  Commit changes:
    ```bash
    /path/to/pmg/vcs/vcs commit
    ```
5.  Push to server:
    ```bash
    /path/to/pmg/vcs/vcs push
    ```

### Viewing Code
Once pushed, go back to the Web Interface. Use the **Search Bar** to find your project. You can now view your code, read the README, check language stats, and see your commit history!



# PMG — Poor Man’s Git

PMG is an **educational experiment** in building a vertically integrated developer platform.
The project explores version control internals, client–server synchronization, static hosting, and developer tooling by intentionally re-implementing **simplified** versions of systems like Git, GitHub Pages, and repository browsers.

PMG prioritizes **clarity, debuggability, and architectural learning** over feature completeness, scalability, or production hardening.

---

## 🎯 Non-Goals

PMG is intentionally limited. It does **not** attempt to provide:

* **Full Git compatibility**
  No branching, rebasing, or DAG-based commit history.
* **Distributed offline-first workflows**
  The system assumes direct client–server synchronization.
* **Large-scale repository performance**
  Not optimized for massive codebases or monorepos.
* **Multi-user real-time collaboration**
  Focused on single-user or sequential workflows.
* **Enterprise-grade security guarantees**
  Security mechanisms exist for learning purposes, not production use.

---

## 📐 Design Trade-offs

* **Linear History Model**
  Chosen to simplify synchronization semantics and make divergence explicit.
  *Trade-off: limits collaboration patterns and prevents complex workflows that require branching.*

* **Folder-based Project Naming:** The system prioritizes the containing folder's name for repository identification on the server, emphasizing the link between local structure and remote state.
  *Trade-off: This can lead to naming conflicts if multiple users push projects with the same folder name, requiring manual resolution or unique naming conventions.*

These trade-offs are deliberate and documented to highlight *why* mature systems like Git are designed differently.

---

## 🚀 Features (Educational Implementations)

### Custom VCS CLI (Go)

A lightweight command-line tool for tracking files and syncing with the PMG server.

* `init` — Initialize a new repository
* `add` — Stage files for commit (supports `ignore.txt`)
* `commit` — Record changes in local history
* `push` — Upload commits to the server
* `pull` — Download and reconcile changes from the server
* `fetch` — Check server state without modifying local files

### Web Interface (React)

A repository browser and project dashboard.

* User authentication (signup & login)
* Repository file browser with folder navigation
* Commit history viewer
* README rendering
* Programming language statistics
* Project search

### Backend API (FastAPI)

Acts as the system’s source of truth.

* File storage and commit persistence
* Authentication via API keys
* Repository metadata management
* Static project hosting support

---

## 🛠️ Tech Stack

* **VCS CLI**: Go, SQLite (local state tracking)
* **Backend**: Python (FastAPI), PostgreSQL (Dockerized), SQLAlchemy
* **Frontend**: React, Vite, CSS Modules

The stack was chosen to emphasize **strong typing**, **explicit state management**, and **clear client–server boundaries**.

---

## 📦 Installation & Setup

### Prerequisites

* Go (VCS CLI)
* Python 3.11+ (Backend)
* Node.js & npm (Frontend)
* Docker (PostgreSQL)

---

### 1. Backend Setup

```bash
cd website/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start PostgreSQL:

```bash
docker run --name postgres \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydb \
  -p 6969:5432 \
  -d postgres:16
```

Run the API server:

```bash
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`.

---

### 2. Frontend Setup

```bash
cd website/frontend
npm install
npm run dev
```

The web interface will be available at `http://localhost:5173`.

---

### 3. VCS CLI Setup

```bash
cd vcs
go build -o vcs
```

The `vcs` binary can now be used in any project directory.

---

## 📖 Usage Guide

### Web Interface

1. Open `http://localhost:5173`
2. Create an account
3. Copy your **API Key** from the dashboard (required for CLI access)

### CLI Workflow

Initialize a project:

```bash
/path/to/vcs init
```

Stage files:

```bash
/path/to/vcs add
```

Commit changes:

```bash
/path/to/vcs commit
```

Push to the server:

```bash
/path/to/vcs push
```

*(Create an `ignore.txt` file in the project root to exclude files or directories.)*

---

### Viewing Projects

After pushing, return to the web interface and search for your project by name.
You can browse files, view commit history, read the README, and inspect language statistics.

---


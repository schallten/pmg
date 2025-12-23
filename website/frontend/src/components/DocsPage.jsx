import React from 'react';
import { Link } from 'react-router-dom';

export default function DocsPage() {
    return (
        <div className="docs_container">
            <aside className="docs_sidebar">
                <nav>
                    <ul>
                        <li><a href="#introduction">Introduction</a></li>
                        <li><a href="#non-goals">Non-Goals</a></li>
                        <li><a href="#trade-offs">Design Trade-offs</a></li>
                        <li><a href="#installation">Installation</a></li>
                        <li><a href="#getting-started">Getting Started</a></li>
                        <li><a href="#commands">Commands Reference</a></li>
                        <li><a href="#ignoring-files">Ignoring Files</a></li>
                        <li><a href="#deployment">Deployment</a></li>
                        <li><a href="#run-vcs">Running VCS</a></li>
                        <li><a href="#run-ide">Running Web IDE</a></li>
                        <li><a href="#run-website">Self-Hosting Website</a></li>
                    </ul>
                </nav>
            </aside>

            <main className="docs_content">
                <section id="introduction">
                    <h1>PMG: An Educational Experiment</h1>
                    <p>
                        PMG is an educational experiment in building a vertically integrated developer platform.
                        The project explores version control internals, client–server synchronization, static hosting, and tooling integration by intentionally re-implementing simplified versions of systems like Git, GitHub Pages, and web-based IDEs.
                    </p>
                    <p>
                        PMG prioritizes clarity, debuggability, and architectural learning over feature completeness or production scalability.
                    </p>
                </section>

                <section id="non-goals">
                    <h2>Explicit Non-Goals</h2>
                    <p>This is defensive engineering documentation. PMG does not try to solve:</p>
                    <ul>
                        <li><strong>Full Git compatibility:</strong> No branching, rebasing, or DAG-based history.</li>
                        <li><strong>Distributed offline-first workflows:</strong> Designed for direct client-server sync.</li>
                        <li><strong>Large-scale repository performance:</strong> Not optimized for massive codebases.</li>
                        <li><strong>Multi-user real-time collaboration:</strong> Focus is on individual project management.</li>
                        <li><strong>Enterprise-grade security guarantees:</strong> Architectural learning takes priority over production hardening.</li>
                    </ul>
                </section>

                <section id="trade-offs">
                    <h2>Design Trade-offs</h2>
                    <div className="command_item">
                        <h3>Linear History Model</h3>
                        <p>Chosen to simplify sync semantics and make divergence detection explicit. Avoids the complexity of DAG traversal while highlighting why Git uses it.</p>
                    </div>
                    <div className="command_item">
                        <h3>Folder-based Project Naming</h3>
                        <p>While the tool prompts for a project name, the system currently prioritizes the containing folder's name for repository identification on the server. This highlights the importance of directory structure in version control systems.</p>
                    </div>
                </section>

                <section id="installation">
                    <h2>Installation</h2>
                    <p>To use the PMG VCS client, you need to have Go installed on your system. Clone the repository and build the binary:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`cd vcs
go build -o vcs main.go`}
                            </code>
                        </pre>
                    </div>
                    <p>This will create a <code>vcs</code> executable in your directory.</p>
                </section>

                <section id="getting-started">
                    <h2>Getting Started</h2>
                    <p>Before you can push code, you need to initialize your project and authenticate with your API key.</p>
                    <ol>
                        <li>
                            <strong>Sign Up:</strong> Create an account on the PMG website to get your API key.
                        </li>
                        <li>
                            <strong>Initialize:</strong> Run the init command in your project root.
                            <div className="code_block">
                                <pre><code>./vcs init</code></pre>
                            </div>
                            Follow the prompts to enter your username and API key.
                            <strong>Note:</strong> The project will be identified on the server by the name of your current directory.
                        </li>
                    </ol>
                </section>

                <section id="commands">
                    <h2>Commands Reference</h2>

                    <div className="command_item">
                        <h3><code>vcs add</code></h3>
                        <p>Stages changes in the current directory for the next commit. It automatically detects new, modified, and deleted files.</p>
                    </div>

                    <div className="command_item">
                        <h3><code>vcs commit</code></h3>
                        <p>Creates a new commit with the staged changes. You will be prompted to enter a commit message (max 50 characters).</p>
                    </div>

                    <div className="command_item">
                        <h3><code>vcs push</code></h3>
                        <p>Uploads your latest commit to the PMG server. This makes your code visible on the website.</p>
                    </div>

                    <div className="command_item">
                        <h3><code>vcs pull</code></h3>
                        <p>Downloads the latest version of a project from the server. If the directory is empty, it will initialize it for you.</p>
                    </div>

                    <div className="command_item">
                        <h3><code>vcs fetch</code></h3>
                        <p>Checks the server for new commits and compares them with your local state. It will notify you if you are ahead or behind the server.</p>
                    </div>
                </section>

                <section id="ignoring-files">
                    <h2>Ignoring Files</h2>
                    <p>
                        To prevent certain files from being tracked (like <code>node_modules</code> or <code>.env</code>),
                        create a file named <code>ignore.txt</code> in your project root.
                    </p>
                    <p>Add one file or directory path per line:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`node_modules
.env
temp/`}
                            </code>
                        </pre>
                    </div>
                </section>

                <section id="deployment">
                    <h2>Deployment</h2>
                    <p>
                        You can deploy your static projects (HTML/CSS/JS) directly from the repository page on the website.
                        Once pushed, go to your repository, click "Deploy", and select your entry point (usually <code>index.html</code>).
                    </p>
                </section>

                <section id="run-vcs">
                    <h2>Running VCS</h2>
                    <p>The VCS is a Go-based command-line tool. To run it from source:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`cd vcs
go build -o vcs main.go
./vcs --help`}
                            </code>
                        </pre>
                    </div>
                    <p>Once built, you can move the <code>vcs</code> binary to your <code>/usr/local/bin</code> or add it to your PATH to use it globally.</p>
                </section>

                <section id="run-ide">
                    <h2>Running Web IDE</h2>
                    <p>The Web IDE is built with Python and uses <code>pywebview</code> for the desktop interface.</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`cd web-ide
python -m venv .venv
source .venv/bin/activate
pip install flask psutil pywebview
python main.py`}
                            </code>
                        </pre>
                    </div>
                    <p>Note: On Linux, you may need to install <code>webkit2gtk</code> dependencies for <code>pywebview</code> to function correctly.</p>
                </section>

                <section id="run-website">
                    <h2>Self-Hosting the Website</h2>
                    <p>The website consists of a FastAPI backend and a React frontend.</p>

                    <h3>1. Backend Setup</h3>
                    <p>The backend requires a PostgreSQL database. You can run one easily with Docker:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`docker run --name pmg-db -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres`}
                            </code>
                        </pre>
                    </div>
                    <p>Then, set up the Python environment:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`cd website/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configure your .env file with DATABASE_URL
uvicorn main:app --reload`}
                            </code>
                        </pre>
                    </div>

                    <h3>2. Frontend Setup</h3>
                    <p>The frontend is a Vite-based React application:</p>
                    <div className="code_block">
                        <pre>
                            <code>
                                {`cd website/frontend
npm install
# Create a .env file with VITE_API_URL=http://localhost:8000
npm run dev`}
                            </code>
                        </pre>
                    </div>
                </section>
            </main>
        </div>
    );
}

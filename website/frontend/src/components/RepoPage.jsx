import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const LANGUAGE_COLORS = {
    'Python': '#3572A5',
    'JavaScript': '#f1e05a',
    'TypeScript': '#2b7489',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Go': '#00ADD8',
    'Java': '#b07219',
    'C++': '#f34b7d',
    'C': '#555555',
    'Rust': '#dea584',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Swift': '#ffac45',
    'Kotlin': '#F18E33',
    'Objective-C': '#438eff',
    'Other': '#ccc'
};

function RepoPage() {
    const { username, project_name } = useParams();
    const [repoData, setRepoData] = useState(null);
    const [languages, setLanguages] = useState({});
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPath, setCurrentPath] = useState('');
    const [fileContent, setFileContent] = useState(null);
    const [activeTab, setActiveTab] = useState('code'); // 'code', 'commits', or 'settings'
    const [currentUser, setCurrentUser] = useState(null);
    const [deploySource, setDeploySource] = useState('index.html');

    useEffect(() => {
        const user = localStorage.getItem('pmg_username');
        setCurrentUser(user);
        fetchRepoData();
    }, [username, project_name]);

    const fetchRepoData = async () => {
        try {
            setLoading(true);

            // Fetch basic repo data
            const token = localStorage.getItem('pmg_api_key');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const repoRes = await fetch(`http://localhost:8000/api/repo/${username}/${project_name}`, {
                headers: headers
            });
            if (!repoRes.ok) throw new Error('Repository not found');
            const repoData = await repoRes.json();
            setRepoData(repoData);
            if (repoData.deploy_source_path) {
                setDeploySource(repoData.deploy_source_path);
            }

            // Fetch languages
            const langRes = await fetch(`http://localhost:8000/api/repo/${username}/${project_name}/languages`);
            if (langRes.ok) {
                const langData = await langRes.json();
                setLanguages(langData.languages || {});
            }

            // Fetch commits
            const commitRes = await fetch(`http://localhost:8000/api/repo/${username}/${project_name}/commits`);
            if (commitRes.ok) {
                const commitData = await commitRes.json();
                setCommits(commitData.commits || []);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = async (path) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:8000/api/repo/${username}/${project_name}/file/${path}`);
            if (!response.ok) throw new Error("Failed to fetch file");
            const data = await response.json();
            setFileContent(data);
            setCurrentPath(path);
        } catch (err) {
            console.error(err);
            alert("Error loading file");
        } finally {
            setLoading(false);
        }
    };

    const handleBackToFiles = () => {
        setFileContent(null);
        setCurrentPath('');
    };

    const handleStar = async () => {
        const token = localStorage.getItem('pmg_api_key');
        if (!token) {
            alert("Please login to star repositories");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/star_repo/${username}/${project_name}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRepoData(prev => ({
                    ...prev,
                    stars: data.total_stars,
                    is_starred: data.is_starred
                }));
            } else {
                const err = await response.json();
                alert(err.detail || "Failed to update star status");
            }
        } catch (err) {
            console.error(err);
            alert("Error updating star status");
        }
    };

    const handleDeploy = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('pmg_api_key');
        if (!token) return;

        try {
            const formData = new FormData();
            formData.append('source_path', deploySource);

            const response = await fetch(`http://localhost:8000/api/deploy/${username}/${project_name}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.message);
                fetchRepoData(); // Refresh data
            } else {
                const err = await response.json();
                alert(err.detail || "Failed to deploy");
            }
        } catch (err) {
            console.error(err);
            alert("Error deploying project");
        }
    };

    const handleFork = async () => {
        const token = localStorage.getItem('pmg_api_key');
        if (!token) {
            alert("Please login to fork repositories");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/fork/${username}/${project_name}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Repository forked successfully to ${data.new_repo_url}`);
            } else {
                const err = await response.json();
                alert(err.detail || "Failed to fork repository");
            }
        } catch (err) {
            console.error(err);
            alert("Error forking repository");
        }
    }

    const deleteRepo = async () => {
        if (!confirm("Are you sure you want to delete this repository? This action cannot be undone.")) return;

        const token = localStorage.getItem('pmg_api_key');
        if (!token) {
            alert("Please login to delete repositories");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/delete_repo/${username}/${project_name}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert("Repository deleted");
                // Redirect to the user's profile page after deletion
                window.location.href = `/profile/${username}`;
            } else {
                const err = await response.json();
                alert(err.detail || "Failed to delete repository");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting repository");
        }
    };

    const handleUndeploy = async () => {
        if (!confirm("Are you sure you want to disable deployment?")) return;

        const token = localStorage.getItem('pmg_api_key');
        if (!token) return;

        try {
            const response = await fetch(`http://localhost:8000/api/undeploy/${username}/${project_name}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert("Deployment disabled");
                fetchRepoData(); // Refresh data
            } else {
                const err = await response.json();
                alert(err.detail || "Failed to undeploy");
            }
        } catch (err) {
            console.error(err);
            alert("Error undeploying project");
        }
    };

    if (loading && !repoData && !fileContent) return <div className="loading">Loading...</div>;
    if (error) return <div className="error_page">Error: {error}</div>;
    if (!repoData) return null;

    const isOwner = currentUser === username;

    return (
        <div className="repo_container">
            <div className="repo_header">
                <div className="repo_title">
                    <div className="repo_link_container">
                        <Link to={`/profile/${username}`} className="repo_owner_link">
                            <span className="repo_owner">{username}</span>
                        </Link>
                        <span className="repo_divider">/</span>
                        <Link to={`/repo/${username}/${project_name}`} onClick={handleBackToFiles} className="repo_name_link">
                            <span className="repo_name">{project_name}</span>
                        </Link>
                    </div>
                    <span className="repo_badge">Public</span>
                    {repoData.isDeployed && (
                        <span className="deployment_badge">Deployed</span>
                    )}
                </div>

                <div className="repo_actions">
                    {repoData.isDeployed && (
                        <a
                            href={`http://localhost:8000${repoData.deployment_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="visit_site_btn"
                        >
                            Visit Site ↗
                        </a>
                    )}
                    <button
                        className={`star_btn ${repoData.is_starred ? 'starred' : ''}`}
                        onClick={handleStar}
                    >
                        {repoData.is_starred ? '★ Starred' : '☆ Star'}
                        <span className="star_count">{repoData.stars}</span>
                    </button>
                    <button className={`fork_btn`} onClick={handleFork}><span className='fork_btn_span'>fork repo</span></button>
                </div>

                {/* Language Bar */}
                {Object.keys(languages).length > 0 && (
                    <div className="language_bar_container">
                        <div className="language_bar">
                            {Object.entries(languages).map(([lang, percent]) => (
                                <div
                                    key={lang}
                                    className="language_segment"
                                    style={{
                                        width: `${percent}%`,
                                        backgroundColor: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS['Other']
                                    }}
                                    title={`${lang}: ${percent}%`}
                                />
                            ))}
                        </div>
                        <div className="language_legend">
                            {Object.entries(languages).map(([lang, percent]) => (
                                <div key={lang} className="legend_item">
                                    <span
                                        className="legend_dot"
                                        style={{ backgroundColor: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS['Other'] }}
                                    />
                                    <span className="legend_text">{lang} {percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="repo_tabs">
                <button
                    className={`tab_btn ${activeTab === 'code' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('code'); handleBackToFiles(); }}
                >
                    Code
                </button>
                <button
                    className={`tab_btn ${activeTab === 'commits' ? 'active' : ''}`}
                    onClick={() => setActiveTab('commits')}
                >
                    Commits
                </button>
                {isOwner && (
                    <button
                        className={`tab_btn ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        Settings
                    </button>
                )}
            </div>

            {activeTab === 'code' && (
                <>
                    {fileContent ? (
                        <div className="file_viewer">
                            <div className="file_header">
                                <span>{fileContent.path}</span>
                                <button onClick={handleBackToFiles} className="btn_secondary">Close File</button>
                            </div>
                            <pre className="code_block">
                                <code>{fileContent.content}</code>
                            </pre>
                        </div>
                    ) : (
                        <div className="repo_content">
                            <div className="file_list_container">
                                <table className="file_table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Size</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {repoData.files.map((file) => (
                                            <tr key={file.path} className="file_row" onClick={() => handleFileClick(file.path)}>
                                                <td className="file_name">
                                                    📄 {file.path}
                                                </td>
                                                <td className="file_size">
                                                    {(file.size / 1024).toFixed(1)} KB
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {repoData.readme && (
                                <div className="readme_container">
                                    <h3>README.md</h3>
                                    <div className="readme_content">
                                        <pre>{repoData.readme}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'commits' && (
                <div className="commits_container">
                    {commits.map((commit) => (
                        <div key={commit.id} className="commit_item">
                            <div className="commit_main">
                                <span className="commit_msg_list">{commit.message}</span>
                                <div className="commit_meta_list">
                                    <span className="commit_author">{commit.author}</span> committed on {new Date(commit.date).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="commit_actions">
                                <span className="commit_hash_badge">{commit.id.substring(0, 7)}</span>
                            </div>
                        </div>
                    ))}
                    {commits.length === 0 && <p className="no_commits">No commits found.</p>}
                </div>
            )}

            {activeTab === 'settings' && isOwner && (
                <div className="settings_container">
                    <h3>Pages</h3>
                    <p className="settings_desc">
                        Host your project as a static website.
                    </p>

                    <div className="settings_card">
                        <form onSubmit={handleDeploy}>
                            <div className="form_group">
                                <label>Source File</label>
                                <input
                                    type="text"
                                    value={deploySource}
                                    onChange={(e) => setDeploySource(e.target.value)}
                                    placeholder="e.g., index.html"
                                    className="settings_input"
                                />
                                <p className="help_text">The file to serve as the entry point (relative to root).</p>
                            </div>

                            <button type="submit" className="btn_primary">
                                {repoData.isDeployed ? 'Update Deployment' : 'Deploy Site'}
                            </button>
                        </form>

                        {repoData.isDeployed && (
                            <div className="deployment_status">
                                <p>✅ Your site is live at:</p>
                                <a
                                    href={`http://localhost:8000${repoData.deployment_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="deployment_link"
                                >
                                    http://localhost:8000{repoData.deployment_url}
                                </a>

                                <button onClick={handleUndeploy} className="btn_danger">
                                    Disable Deployment
                                </button>
                            </div>
                        )}
                    </div>
                    <div className='delete-repo'>
                        <h3>Delete Repository</h3>
                        <p className="delete_settings_desc">
                            Permanently delete this repository. This action cannot be undone.
                        </p>
                        <button className="btn_danger" onClick={deleteRepo}>
                            Delete Repository
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RepoPage;

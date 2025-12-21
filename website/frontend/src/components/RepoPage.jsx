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
    const [activeTab, setActiveTab] = useState('code'); // 'code' or 'commits'

    useEffect(() => {
        fetchRepoData();
    }, [username, project_name]);

    const fetchRepoData = async () => {
        try {
            setLoading(true);

            // Fetch basic repo data
            const repoRes = await fetch(`http://localhost:8000/api/repo/${username}/${project_name}`);
            if (!repoRes.ok) throw new Error('Repository not found');
            const repoData = await repoRes.json();
            setRepoData(repoData);

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

    if (loading && !repoData && !fileContent) return <div className="loading">Loading...</div>;
    if (error) return <div className="error_page">Error: {error}</div>;
    if (!repoData) return null;

    return (
        <div className="repo_container">
            <div className="repo_header">
                <div className="repo_title">
                    <Link to={`/repo/${username}/${project_name}`} onClick={handleBackToFiles} className="repo_link">
                        <span className="repo_owner">{username}</span>
                        <span className="repo_divider">/</span>
                        <span className="repo_name">{project_name}</span>
                    </Link>
                    <span className="repo_badge">Public</span>
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
        </div>
    );
}

export default RepoPage;

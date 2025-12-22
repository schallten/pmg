import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function ProfilePage() {
    const { username } = useParams();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:8000/api/profile/${username}`);
                if (!response.ok) {
                    throw new Error('User not found');
                }
                const data = await response.json();
                setProfileData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [username]);

    if (loading) return <div className="loading">Loading profile...</div>;
    if (error) return <div className="error_page">Error: {error}</div>;
    if (!profileData) return null;

    return (
        <div className="profile_container">
            <div className="profile_sidebar">
                <img
                    src={profileData.gravatar_url}
                    alt={`${profileData.username}'s avatar`}
                    className="profile_avatar"
                />
                <h1 className="profile_name">{profileData.username}</h1>
                <p className="profile_joined">Joined {new Date(profileData.joined_at).toLocaleDateString()}</p>
            </div>

            <div className="profile_content">
                <h2 className="section_title">Repositories</h2>
                <div className="repo_list">
                    {profileData.projects.length === 0 ? (
                        <p className="no_repos">This user has no repositories yet.</p>
                    ) : (
                        profileData.projects.map((project) => (
                            <div key={project.project_name} className="repo_card">
                                <Link to={`/repo/${profileData.username}/${project.project_name}`} className="repo_card_link">
                                    <h3 className="repo_card_name">{project.project_name}</h3>
                                </Link>
                                <div className="repo_card_meta">
                                    <span>Updated {new Date(project.last_updated).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;

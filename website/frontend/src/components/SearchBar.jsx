import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.trim().length === 0) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/search/${query}`);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data.results || []);
                }
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (query) fetchResults();
            else setResults([]);
        }, 300); // Debounce

        return () => clearTimeout(timeoutId);
    }, [query]);

    return (
        <div className="search_container">
            <input
                type="text"
                className="search_input"
                placeholder="Search projects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
                <div className="search_results">
                    {results.map((project) => (
                        <Link
                            key={`${project.username}/${project.project_name}`}
                            to={`/repo/${project.username}/${project.project_name}`}
                            className="search_result_item"
                            onClick={() => {
                                setQuery('');
                                setResults([]);
                            }}
                        >
                            <div className="result_content">
                                <span className="result_name">{project.project_name}</span>
                                <span className="result_owner">by {project.username}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SearchBar;

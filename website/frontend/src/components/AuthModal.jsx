import React, { useState } from 'react';

function AuthModal({ mode, onClose, onAuthSuccess }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [apiKey, setApiKey] = useState(null);

    const isLogin = mode === 'login';
    const title = isLogin ? 'Login' : 'Sign Up';
    const endpoint = isLogin ? '/api/login' : '/api/signup';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);

        try {
            const response = await fetch(`http://localhost:8000${endpoint}`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('pmg_api_key', data.api_key);
                localStorage.setItem('pmg_username', username);
                onAuthSuccess(username);
                setApiKey(data.api_key);
            } else {
                setError(data.detail || 'Something went wrong');
            }
        } catch (err) {
            setError('Failed to connect to server');
            console.error(err);
        }
    };

    if (apiKey) {
        return (
            <div className="modal_overlay">
                <div className="modal_content">
                    <div className="modal_header">
                        <h2>Success!</h2>
                        <button onClick={onClose} className="close_btn">&times;</button>
                    </div>
                    <p>Welcome, {username}!</p>
                    <div className="api_key_box">
                        <p>Your API Key:</p>
                        <code className="api_key_code">{apiKey}</code>
                    </div>
                    <p className="warning_text">Save this key! You'll need it to use PMG from the terminal.</p>
                    <button onClick={onClose} className="submit_btn">Got it</button>
                </div>
            </div>
        );
    }

    return (
        <div className="modal_overlay">
            <div className="modal_content">
                <div className="modal_header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="close_btn">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="auth_form">
                    <div className="form_group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form_group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="error_msg">{error}</p>}

                    <button type="submit" className="submit_btn">
                        {title}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AuthModal;

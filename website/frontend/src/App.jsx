import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/header";
import Hero from "./components/hero";
import AuthModal from "./components/AuthModal";
import RepoPage from "./components/RepoPage";
import "./App.css";

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('pmg_username');
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleSignupClick = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (username) => {
    setUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('pmg_api_key');
    localStorage.removeItem('pmg_username');
    setUser(null);
  };

  return (
    <Router>
      <div>
        <Header
          user={user}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoutClick={handleLogout}
        />

        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/repo/:username/:project_name" element={<RepoPage />} />
        </Routes>

        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
          />
        )}
      </div>
    </Router>
  );
}

export default App;
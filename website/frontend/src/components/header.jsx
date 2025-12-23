import React from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';

function Header({ user, onLoginClick, onSignupClick, onLogoutClick }) {
  return (
    <header className="header_header">
      <Link to="/" className="header_logo_link">
        <img src="/logo.png" alt="PMG Logo" className="header_logo" />
      </Link>

      <SearchBar />

      <nav className="header_nav">
        <Link to="/docs" className="header_docs_link">Docs</Link>
        {user ? (
          <>
            <span style={{ color: '#e6edf3', fontSize: '0.95rem' }}>Hi, {user}</span>
            <button onClick={onLogoutClick}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={onLoginClick}>Login</button>
            <button onClick={onSignupClick}>Sign Up</button>
          </>
        )}
      </nav>
    </header>
  );
}

export default Header;

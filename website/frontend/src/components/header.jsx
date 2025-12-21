import React from 'react';

import SearchBar from './SearchBar';

function Header({ user, onLoginClick, onSignupClick, onLogoutClick }) {
  return (
    <header className="header_header">
      <p className="header_name">PMG - Poor Man's Git</p>

      <SearchBar />

      <nav className="header_nav">
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

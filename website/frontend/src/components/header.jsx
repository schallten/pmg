import React from 'react';

function Header() {
  return (
    <header className="header_header">
      <p className="header_name">PMG - Poor Man's Git</p>

      <nav className="header_nav">
        <button>Login</button>
        <button>Sign Up</button>
      </nav>
    </header>
  );
}

export default Header;

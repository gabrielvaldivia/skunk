import React from 'react';

import NavLink from './NavLink';
import './App.css';

function Nav() {
  return (
    <div className="d-flex ox-scroll ws-nowrap hide-scrollbar pt-24px ph-24px">
      <NavLink to="/">
        Smash Bros
      </NavLink>
      <NavLink to="/ping-pong">
        Ping Pong
      </NavLink>
    </div>
  );
}

export default Nav;
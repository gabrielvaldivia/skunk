import React from 'react';
import { NavLink } from "react-router-dom";

import './App.css';

function Nav() {
  const navLinkClassNames = "m-0px mr-32px ff-big-noodle fw-normal fs-60px c-white td-none o-0_5";

  return (
    <div className="d-flex ox-scroll ws-nowrap hide-scrollbar pt-24px ph-24px">
      <NavLink
        exact
        to="/"
        className={navLinkClassNames}
        activeClassName="o-1"
      >
        Smash Bros
      </NavLink>
      <NavLink
        exact
        to="/ping-pong"
        className={navLinkClassNames}
        activeClassName="o-1"
      >
        Ping Pong
      </NavLink>
    </div>
  );
}

export default Nav;
import React from 'react';

import './App.css';

function Nav() {
  return (
    <div className="d-flex ox-scroll ws-nowrap hide-scrollbar pt-24px ph-24px">
      <h1 className="ff-big-noodle fw-normal fs-60px c-white m-0px mr-32px">
        Smash Bros
      </h1>
      <h1 className="ff-big-noodle fw-normal fs-60px c-white m-0px mr-32px o-0_5">
        Ping Pong
      </h1>
    </div>
  );
}

export default Nav;
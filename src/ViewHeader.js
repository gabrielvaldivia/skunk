import React from 'react';

import './App.css';

function ViewHeader({ img, title, subtitle }) {
  return (
    <div className="d-flex ai-center mt-50px mb-50px">
      <div
        className="w-112px h-112px cp-polygon bs-cover"
        style={{ backgroundImage: 'url(' + img + ')'}}
      >
      </div>
      <div className="ml-24px">
        <h3 className="ff-big-noodle fw-normal fs-28px c-white m-0px mb-2px o-0_5">
          {subtitle}
        </h3>
        <h1 className="ff-big-noodle fw-normal fs-60px c-white m-0px mr-32px">
          {title ? title : "Loading..."}
        </h1>
      </div>
    </div>
  );
}

export default ViewHeader;
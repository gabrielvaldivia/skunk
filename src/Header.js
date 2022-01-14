import React from 'react';

import './App.css';

function Header({ header, img1, img2 }) {
	return (
		<div className="d-flex ai-center mb-16px">
			<h2 className="f-1 m-0px ff-big-noodle fw-normal fs-40px c-white">
        {header}
      </h2>
      <div className="d-flex f-1 ai-center">
        <div className="d-flex f-1 jc-flex-end">
          <div
            className="w-40px h-40px cp-polygon bs-cover"
            style={{ backgroundImage: 'url(' + img1 + ')'}}
          >
          </div>
        </div>
        <div className="d-flex f-1 jc-flex-end">
          <div
            className="w-40px h-40px cp-polygon bs-cover"
            style={{ backgroundImage: 'url(' + img2 + ')'}}
          >
          </div>
        </div>
      </div>
		</div>
	);
}

export default Header;
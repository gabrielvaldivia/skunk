import React from 'react';

import './App.css';

function Cell({ title, col1, col2 }) {
  let col1ClassNames = "d-flex f-1 jc-flex-end m-0px pr-16px ff-big-noodle fs-24px c-white";
  let col2ClassNames = "d-flex f-1 jc-flex-end m-0px pr-16px ff-big-noodle fs-24px c-white";

  if (col1 > col2) {
    col2ClassNames += " o-0_5";
  }
  else if (col1 < col2) {
    col1ClassNames += " o-0_5";
  }
  else {
    col1ClassNames += " o-0_5";
    col2ClassNames += " o-0_5";
  }

	return (
		<div className="d-flex ai-center mb-16px">
			<p className="m-0px f-1 o-0_5 ff-big-noodle fs-24px c-white">
        {title}
      </p>
      <div className="d-flex f-1">
        <p className={col1ClassNames}>
          {col1}
        </p>
        <p className={col2ClassNames}>
          {col2}
        </p>
      </div>
		</div>
	);
}

export default Cell;
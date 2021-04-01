import React from 'react';

import './App.css';

function Cell({ title, col1, col2 }) {
  let col1ClassNames = "col";
  let col2ClassNames = "col";

  if (col1 > col2) {
    col2ClassNames = "col loser";
  }
  else {
    col1ClassNames = "col loser";
  }

	return (
		<div className="cell">
			<div className="title">{title}</div>
			<div className={col1ClassNames}>{col1}</div>
			<div className={col2ClassNames}>{col2}</div>
		</div>
	);
}

export default Cell;
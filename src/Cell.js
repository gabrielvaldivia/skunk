import React from 'react';

import './App.css';

function Cell({ title, col1, col2 }) {
  let col1ClassNames = "col pr-16";
  let col2ClassNames = "col pr-16";

  if (col1 > col2) {
    col2ClassNames += " loser";
  }
  else if (col1 < col2) {
    col1ClassNames += " loser";
  }
  else {
    col1ClassNames += " loser";
    col2ClassNames += " loser";
  }

	return (
		<div className="cell">
			<div className="title">{title}</div>
      <div className="values">
        <div className={col1ClassNames}>{col1}</div>
        <div className={col2ClassNames}>{col2}</div>
      </div>
		</div>
	);
}

export default Cell;
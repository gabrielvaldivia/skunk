import React from 'react';

import './App.css';

function Cell({ title, col1, col2 }) {
	return (
		<div className="cell">
			<div className="title">{title}</div>
			<div className="col">{col1}</div>
			<div className="col">{col2}</div>
		</div>
	);
}

export default Cell;
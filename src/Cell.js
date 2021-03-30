import React from 'react';

import './App.css';

function Cell({ title, col1, col2 }) {
	return (
		<div>
			<div>{title}</div>
			<div>{col1}</div>
			<div>{col2}</div>
		</div>
	);
}

export default Cell;
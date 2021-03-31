import React from 'react';

import './App.css';

function Header({ header, img1, img2 }) {
	return (
		<div className="header">
			<h2>{header}</h2>
			<div className="col">
				<div className= "player-image" 
				style={{
					backgroundImage: 'url(' + img1 + ')'
				}}
				>
				</div>
			</div>
			
			<div className="col">
				<div className= "player-image" 
				style={{
					backgroundImage: 'url(' + img2 + ')'
				}}
				>
				</div>
			</div>

		</div>
	);
}

export default Header;
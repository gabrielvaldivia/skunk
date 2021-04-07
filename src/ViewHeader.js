import React from 'react';

import './App.css';

function ViewHeader({ img, title }) {
  return (
    <div className="view-header-container">
      <div className="player-image-lg" style={{ backgroundImage: 'url(' + img + ')'}}></div>
      <div className="view-header-content">
        <h3 className="mb-1">
          Current champ
        </h3>
        <h1>
          {title}
        </h1>
      </div>
    </div>
  );
}

export default ViewHeader;
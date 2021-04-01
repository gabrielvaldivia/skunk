import React, { useState, useEffect } from 'react';
import { base, BASE_NAME, VIEW_NAME } from './airtable';
import { generateOverview } from './helpers';

import Cell from './Cell';
import Header from './Header';
import Player1Image from './assets/gabe.jpg';
import Player2Image from './assets/claudio.jpg';

import './App.css';

function App() {
  const [overview, setOverview] = useState({
    sessionsWon: {
      claudioSessionsWon: 0,
      gabrielSessionsWon: 0,
    },
    matchesWon: {
      claudioMatchesWon: 0,
      gabrielMatchesWon: 0,
    },
    sessionHistory: []
  });

  useEffect(() => {
    async function getData() {
      await base(BASE_NAME)
        .select({ view: VIEW_NAME })
        .firstPage()
        .then(response => {
          setOverview(generateOverview(response));
        });
    };

    getData();
  }, []);

  return (
    <div className="body">
      <h1>Ping Pong</h1>
      <div className="container">
        <Header
          header="Players"
          img1={Player1Image}
          img2={Player2Image}
        />
        <Cell
          title="Sessions won"
          col1={overview.sessionsWon.gabrielSessionsWon}
          col2={overview.sessionsWon.claudioSessionsWon}
        />
        <Cell
          title="Matches won"
          col1={overview.matchesWon.gabrielMatchesWon}
          col2={overview.matchesWon.claudioMatchesWon}
        />
      </div>
      <div className="container">
        <h2>Sessions</h2>
        {overview.sessionHistory.map(session => (
          <Cell
            title={session.date}
            col1={session.gabrielMatchesWon}
            col2={session.claudioMatchesWon}
          />
        ))}
      </div>
    </div>
  )
}

export default App;
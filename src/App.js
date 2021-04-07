import React, { useState, useEffect } from 'react';
import { base, BASE_NAME, VIEW_NAME } from './airtable';
import { generateOverview } from './helpers';

import Cell from './Cell';
import Header from './Header';
import Player1Image from './assets/gabe.jpg';
import Player2Image from './assets/claudio.jpg';
import PlaceholderImage from './assets/placeholder.png';

import './App.css';
import ViewHeader from './ViewHeader';

function App() {
  const [overview, setOverview] = useState({
    currentChamp: {
      name: '...',
    },
    sessionsWon: {
      claudioSessionsWon: 0,
      gabrielSessionsWon: 0,
    },
    matchesWon: {
      claudioMatchesWon: 0,
      gabrielMatchesWon: 0,
    },
    sessionHistory: [],
    skunks: {
      claudio: 0,
      gabriel: 0,
    },
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

  let currentChampImg = '';
  if (overview.currentChamp.name === 'Claudio') {
    currentChampImg = Player2Image;
  }
  else if (overview.currentChamp.name === 'Gabriel') {
    currentChampImg = Player1Image;
  }
  else {
    currentChampImg = PlaceholderImage;
  }

  return (
    <div className="body">
      <div className="view-title">
        <h1>Ping Pong</h1>
      </div>
      <ViewHeader
        title={overview.currentChamp.name}
        img={currentChampImg}
      />
      <div className="container">
        <Header
          header="Stats"
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
        <Cell
          title="Skunks"
          col1={overview.skunks.gabriel}
          col2={overview.skunks.claudio}
        />
      </div>
      <div className="container">
        <Header
          header="Sessions"
          img1=""
          img2=""
        />
        {overview.sessionHistory.map(session => (
          <Cell
            key={session.date}
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
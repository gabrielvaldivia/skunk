import React from 'react';
import { useEffect,useState } from 'react/cjs/react.development';
import { base } from './airtable';
import { generateOverview } from './helpers';

import Nav from './Nav';
import Cell from './Cell';
import ViewHeader from './ViewHeader';
import Header from './Header';

import './App.css';
import ClaudioImage from './assets/claudio.jpg';
import GabrielImage from './assets/gabriel.jpg';
import PlaceholderImage from './assets/placeholder.png';

function View({ airtableBase, airtableView, skunkScore, backgroundColorClassName }) {
  const [overview, setOverview] = useState({
    currentChamp: "",
    claudio: {
      sessionsWon: 0,
      matchesWon: 0,
      skunks: 0,
    },
    gabriel: {
      sessionsWon: 0,
      matchesWon: 0,
      skunks: 0,
    },
    sessionHistory: []
  });

  useEffect(() => {
    async function getData() {
      await base(airtableBase)
        .select({ view: airtableView })
        .firstPage()
        .then(response => {
          setOverview(generateOverview(response, skunkScore))
        });
    };

    getData();
  }, [airtableBase, airtableView, skunkScore]);

  let currentChampImage = '';
  if (overview.currentChamp === 'Claudio') {
    currentChampImage = ClaudioImage;
  }
  else if (overview.currentChamp === 'Gabriel') {
    currentChampImage = GabrielImage;
  }
  else {
    currentChampImage = PlaceholderImage;
  }

  return (
    <div className={`h-100p ${backgroundColorClassName}`}>
      <Nav />
      <div className="mw-400px mh-auto ph-24px">
        <ViewHeader
          title={overview.currentChamp}
          subtitle="Current champ"
          img={currentChampImage}
        />
        <div className="mb-40px">
          <Header
            header="Stats"
            img1={GabrielImage}
            img2={ClaudioImage}
          />
          <Cell
            title="Sessions won"
            col1={overview.gabriel.sessionsWon}
            col2={overview.claudio.sessionsWon}
          />
          <Cell
            title="Matches won"
            col1={overview.gabriel.matchesWon}
            col2={overview.claudio.matchesWon}
          />
          <Cell
            title="Skunks"
            col1={overview.gabriel.skunks}
            col2={overview.claudio.skunks}
          />
        </div>
        <div className="mb-40px">
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
    </div>
  );
}

export default View;
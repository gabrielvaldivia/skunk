import React, { useState, useEffect } from 'react';
import { base, BASE_NAME, VIEW_NAME } from './airtable';
import { generateOverview } from './helpers';

import Cell from './Cell';

import './App.css';

function App() {
  const [overview, setOverview] = useState({});

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

  console.log(overview);

  return (
    <div className="body">
      <h1>Ping Pong</h1>
      <div className="container">
        <h2>Players</h2>
        <Cell
          title="Sessions won"
          col1="16"
          col2="5"
        />
        <Cell
          title="Matches won"
          col1="6"
          col2="4"
        />
        <Cell
          title="Longest streak"
          col1="6"
          col2="4"
        />
        <Cell
          title="Biggest win"
          col1="6"
          col2="4"
        />
        <Cell
          title="Skunks"
          col1="6"
          col2="4"
        />
      </div>

      <div className="container">
        <h2>Sessions</h2>
        <Cell
          title="TUE, MAR 30"
          col1="16"
          col2="5"
        />
        <Cell
          title="MON, MAR 29"
          col1="6"
          col2="4"
        />
      </div>
    </div>
  )
}

export default App;
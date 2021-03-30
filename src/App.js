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
      <Cell
        title="MON, MAR 29"
        col1="6"
        col2="4"
      />
      <Cell
        title="TUE, MAR 30"
        col1="16"
        col2="5"
      />
    </div>
  )
}

export default App;
import React, { useState, useEffect } from 'react';
import { base, BASE_NAME, VIEW_NAME } from './airtable';
import { generateOverview } from './helpers';

import './App.css';

function App() {
  const [overview, setOverview] = useState({});

  useEffect(() => {
    async function getData() {
      await base(BASE_NAME)
        .select({ view: VIEW_NAME })
        .firstPage()
        .then(response => {
          console.log(response);
          setOverview(generateOverview(response));
        });
    };

    getData();
  }, []);

  console.log(overview);

  return (
    <div>
      SKUNK
      {overview && <div>YAY!</div>}
    </div>
  )
}

export default App;
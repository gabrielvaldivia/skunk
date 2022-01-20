import React from 'react';
import { Routes, Route } from 'react-router-dom';

import View from './View';

import { PING_PONG_SKUNK_SCORE, SMASH_BROS_SKUNK_SCORE } from './helpers';

import './App.css';

function SmashBros() {
  return (
    <View
      airtableBase="smashBros"
      airtableView="gridView"
      skunkScore={SMASH_BROS_SKUNK_SCORE}
      backgroundColorClassName="bc-orange"
    />
  );
}

function PingPong() {
  return (
    <View
      airtableBase="pingPong"
      airtableView="gridView"
      skunkScore={PING_PONG_SKUNK_SCORE}
      backgroundColorClassName="bc-purple"
    />
  );
}

function App() {
  return (
    <Routes>
      <Route exact path="/" element={<SmashBros />} />
      <Route exact path="/ping-pong" element={<PingPong />} />
    </Routes>
  );
}

export default App;
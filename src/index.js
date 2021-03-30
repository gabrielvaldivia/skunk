import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import Airtable from 'airtable';
import axios from 'axios';
import reportWebVitals from './reportWebVitals';

const BASE_ID = 'app3ZX4aIHsHbq1Z4';
const TABLE_NAME = 'SKUNK';


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

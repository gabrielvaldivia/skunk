import Airtable from "airtable";

export const base = new Airtable({
  apiKey: process.env.REACT_APP_AIRTABLE_API_KEY
}).base(process.env.REACT_APP_AIRTABLE_BASE_ID);

export const BASE_NAME = "matches";
export const VIEW_NAME = "Grid view";
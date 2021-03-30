import moment from 'moment';

const setMatchWinner = (sessionObject, winnerName) => {
  if (winnerName === 'Claudio') {
    sessionObject['claudioMatchesWon'] += 1;
  }
  else if (winnerName === 'Gabriel') {
    sessionObject['gabrielMatchesWon'] += 1;
  }
};

const generateSessionHistory = (records) => {
  const sessionHistory = {}; 

  records.forEach(record => {
    const date = moment(record.fields.date).format('ddd, MMM DD');

    if (!(date in sessionHistory)) {
      sessionHistory[date] = {};
      sessionHistory[date]['claudioMatchesWon'] = 0;
      sessionHistory[date]['gabrielMatchesWon'] = 0;
    }

    setMatchWinner(sessionHistory[date], record.fields.matchWinner);
  });

  return sessionHistory;
};

export const generateOverview = (records) => {
  const sessionHistory = generateSessionHistory(records);

  return {
    sessionHistory,
  };
};
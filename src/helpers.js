import moment from 'moment';

const setMatchWinner = (sessionObject, winnerName) => {
  if (winnerName === 'Claudio') {
    sessionObject['claudioMatchesWon'] += 1;
  }
  else {
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

const generateSessionWins = (sessionHistory) => {
  const sessionsWon = {
    claudioSessionsWon: 0,
    gabrielSessionsWon: 0,
  };

  Object.entries(sessionHistory).forEach(([date, session]) => {
    if (session['claudioMatchesWon'] > session['gabrielMatchesWon']) {
      sessionsWon['claudioSessionsWon'] += 1;
    }
    else {
      sessionsWon['gabrielSessionsWon'] += 1;
    }
  });

  return sessionsWon;
};

export const generateOverview = (records) => {
  const sessionHistory = generateSessionHistory(records);
  const sessionsWon = generateSessionWins(sessionHistory);

  return {
    sessionHistory,
    sessionsWon,
  };
};
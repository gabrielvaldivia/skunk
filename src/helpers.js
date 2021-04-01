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

  const sessionHistoryArray = Object.keys(sessionHistory).map(key => {
    return {
      date: key,
      claudioMatchesWon: sessionHistory[key]['claudioMatchesWon'],
      gabrielMatchesWon: sessionHistory[key]['gabrielMatchesWon'],
    };
  });

  return sessionHistoryArray;
};

const calculateSessionWins = (sessionHistory) => {
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

const calculateMatchesWon = (sessionHistory) => {
  const matchesWon = {
    claudioMatchesWon: 0,
    gabrielMatchesWon: 0,
  };

  Object.entries(sessionHistory).forEach(([date, session]) => {
    matchesWon['claudioMatchesWon'] += session['claudioMatchesWon'];
    matchesWon['gabrielMatchesWon'] += session['gabrielMatchesWon'];
  });

  return matchesWon;
};

export const generateOverview = (records) => {
  const sessionHistory = generateSessionHistory(records);
  const sessionsWon = calculateSessionWins(sessionHistory);
  const matchesWon = calculateMatchesWon(sessionHistory);

  return {
    sessionsWon,
    matchesWon,
    sessionHistory,
  };
};
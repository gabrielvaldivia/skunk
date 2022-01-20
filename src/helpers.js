import moment from 'moment';

export const PING_PONG_SKUNK_SCORE = { max: 7, min: 0 };
export const SMASH_BROS_SKUNK_SCORE = { max: 3, min: 0 };
export const STATE_OBJECT = {
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
};

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

  sessionHistoryArray.sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf());

  return sessionHistoryArray;
};

const calculateSessionWins = (sessionHistory) => {
  const sessionsWon = {
    claudio: 0,
    gabriel: 0
  };

  Object.entries(sessionHistory).forEach(([_, session]) => {
    if (session.claudioMatchesWon > session.gabrielMatchesWon) {
      sessionsWon.claudio += 1;
    }
    else {
      sessionsWon.gabriel += 1;
    }
  });

  return sessionsWon;
};

const calculateMatchesWon = (sessionHistory) => {
  const matchesWon = {
    claudio: 0,
    gabriel: 0
  };

  Object.entries(sessionHistory).forEach(([_, session]) => {
    matchesWon.claudio += session['claudioMatchesWon'];
    matchesWon.gabriel += session['gabrielMatchesWon'];
  });

  return matchesWon;
};

const calculateTotalSkunks = (records, skunkScore) => {
  const skunks = {
    claudio: 0,
    gabriel: 0
  };

  records.forEach(record => {
    if (record.fields.claudioPoints >= skunkScore.max && record.fields.gabrielPoints === skunkScore.min) {
      skunks.claudio += 1;
    }
    else if (record.fields.gabrielPoints >= skunkScore.max && record.fields.claudioPoints === skunkScore.min) {
      skunks.gabriel += 1;
    }
  });

  return skunks;
};

const setCurrentChamp = (sessionsWon) => {
  let currentChamp = '';

  if (sessionsWon.claudio > sessionsWon.gabriel) {
    currentChamp = 'Claudio';
  }
  else if (sessionsWon.gabriel > sessionsWon.claudio) {
    currentChamp = 'Gabriel';
  }

  return currentChamp;
};

export const generateOverview = (records, skunkScore) => {
  const sessionHistory = generateSessionHistory(records);
  const sessionsWon = calculateSessionWins(sessionHistory);
  const matchesWon = calculateMatchesWon(sessionHistory);
  const skunks = calculateTotalSkunks(records, skunkScore);
  const currentChamp = setCurrentChamp(sessionsWon);

  return {
    currentChamp,
    claudio: {
      sessionsWon: sessionsWon.claudio,
      matchesWon: matchesWon.claudio,
      skunks: skunks.claudio,
    },
    gabriel: {
      sessionsWon: sessionsWon.gabriel,
      matchesWon: matchesWon.gabriel,
      skunks: skunks.gabriel,
    },
    sessionHistory,
  };
};
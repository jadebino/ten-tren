

function getLine(lineId) {
  return TRANSIT_LINES[lineId || 'lrt2'] || TRANSIT_LINES.lrt2;
}

/** Upcoming trains (both directions) at a station for a given moment. */
function getArrivals(lineId, stationId, currentTime) {
  const line = getLine(lineId);
  const station = line.stations.find((s) => s.id === stationId);
  if (!station) return [];

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  let startMinutes = 5 * 60;
  let endForwardMinutes = 21 * 60 + 30;
  let endReverseMinutes = 21 * 60;
  let term1;
  let term2;
  let dirForward;
  let dirBackward;

  if (line.id === 'lrt1') {
    startMinutes = 4 * 60 + 30;
    endForwardMinutes = 22 * 60 + 15;
    endReverseMinutes = 22 * 60;
    term1 = 'Dr. Santos (Southbound)';
    term2 = 'Fernando Poe Jr. (Northbound)';
    dirForward = 'Southbound';
    dirBackward = 'Northbound';
  } else if (line.id === 'mrt3') {
    startMinutes = 4 * 60 + 38;
    endForwardMinutes = 22 * 60 + 10;
    endReverseMinutes = 21 * 60 + 30;
    term1 = 'Taft Avenue (Southbound)';
    term2 = 'North Avenue (Northbound)';
    dirForward = 'Southbound';
    dirBackward = 'Northbound';
  } else {
    term1 = 'Antipolo (Eastbound)';
    term2 = 'Recto (Westbound)';
    dirForward = 'Eastbound';
    dirBackward = 'Westbound';
  }

  const arrivals = [];

  // Peak hours: 6-10 AM and 4-8 PM
  const hr = currentTime.getHours();
  const isPeak = (hr >= 6 && hr < 10) || (hr >= 16 && hr < 20);
  const headway = isPeak ? line.schedule.headwayPeak : line.schedule.headwayOffPeak;
  const totalRunMins = line.avgDurationMins;

  // Forward direction (Eastbound / Southbound)
  if (station.position < line.stations.length - 1) {
    if (nowMinutes >= startMinutes && nowMinutes < endForwardMinutes + totalRunMins) {
      const elapsedSinceStart = Math.max(0, nowMinutes - startMinutes);
      const nextTrainIn = Math.max(1, headway - (elapsedSinceStart % headway));

      [0, 1, 2].forEach((offset) => {
        const waitTime = nextTrainIn + offset * headway;
        if (nowMinutes + waitTime <= endForwardMinutes + totalRunMins) {
          arrivals.push({
            destination: term1.split(' (')[0],
            direction: dirForward,
            eta: waitTime,
            status: waitTime <= 2 ? 'Approaching' : offset === 2 && Math.random() > 0.85 ? 'Delayed' : 'On Time',
            cars: 4,
          });
        }
      });
    }
  }

  // Reverse direction (Westbound / Northbound)
  if (station.position > 0) {
    if (nowMinutes >= startMinutes && nowMinutes < endReverseMinutes + totalRunMins) {
      const elapsedSinceStart = Math.max(0, nowMinutes - startMinutes);
      // Offset reverse trains slightly so both directions don't arrive together
      const nextTrainIn = Math.max(1, (headway - (elapsedSinceStart % headway) + 2) % headway || headway);

      [0, 1, 2].forEach((offset) => {
        const waitTime = nextTrainIn + offset * headway;
        if (nowMinutes + waitTime <= endReverseMinutes + totalRunMins) {
          arrivals.push({
            destination: term2.split(' (')[0],
            direction: dirBackward,
            eta: waitTime,
            status: waitTime <= 2 ? 'Approaching' : 'On Time',
            cars: 4,
          });
        }
      });
    }
  }

  return arrivals.sort((a, b) => a.eta - b.eta);
}

/** Clock time you reach the destination if you catch the given arrival. */
function calculateTripETA(lineId, originId, destinationId, arrivalAtOrigin, currentTime) {
  const line = getLine(lineId);
  const origin = line.stations.find((s) => s.id === originId);
  const destination = line.stations.find((s) => s.id === destinationId);
  if (!origin || !destination) return currentTime;

  const originTravel = line.travelTimes[origin.position] ?? origin.position * 2.5;
  const destTravel = line.travelTimes[destination.position] ?? destination.position * 2.5;
  const travelDuration = Math.abs(destTravel - originTravel);

  const eta = new Date(currentTime.getTime());
  eta.setMinutes(eta.getMinutes() + arrivalAtOrigin.eta + travelDuration);
  return eta;
}

/** Is the station open, closing soon, or closed? */
function getStationStatus(lineId, stationId, currentTime) {
  const line = getLine(lineId);
  const station = line.stations.find((s) => s.id === stationId);
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  let startMinutes = 5 * 60;
  let lastCloseMinutes = 21 * 60 + 30;

  if (line.id === 'lrt1') {
    startMinutes = 4 * 60 + 30;
    lastCloseMinutes = 22 * 60 + 15;
  } else if (line.id === 'mrt3') {
    startMinutes = 4 * 60 + 38;
    lastCloseMinutes = 22 * 60 + 10;
  }

  const stationPos = station ? station.position : 0;
  const timeOffset = line.travelTimes[stationPos] || stationPos * 2;
  const stationLastTrainMinutes = lastCloseMinutes + timeOffset;

  if (nowMinutes < startMinutes) {
    return { status: 'CLOSED', message: `Station is currently closed. First morning departure at ${line.schedule.firstTrain}.` };
  }
  if (nowMinutes > stationLastTrainMinutes + 12) {
    return { status: 'CLOSED', message: 'Station closed for the night. Last passenger train has already cleared.' };
  }
  if (nowMinutes > stationLastTrainMinutes - 15) {
    return { status: 'CLOSING SOON', message: 'Final train service of the night approaching. Gates close in less than 15 mins.' };
  }
  return { status: 'NORMAL OPERATIONS', message: `All ${line.stations.length} stations on ${line.code} are open and operating on schedule.` };
}

/* ---------- Auth / commuter session ---------- */

const STORAGE_KEY = 'tenten_google_commuter_session_v2';

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveUser(user) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to update commuter session', e);
  }
}

function createGoogleUser(email = 'jeydieb05@gmail.com', customName) {
  const name =
    customName ||
    (email.includes('@')
      ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      : 'Google Commuter');

  return {
    id: `google-${Date.now()}`,
    name,
    email,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0055A4,00843D,0038A8`,
    provider: 'google',
    commuterType: 'regular',
    defaultLine: 'lrt2',
    beepCardBalance: 150.0,
    savedRoutes: [
      { id: 'route-default-1', label: 'Cubao ↔ Recto Express', lineId: 'lrt2', originId: 'cubao', destinationId: 'recto' },
    ],
    notificationPreferences: { arrivalAlerts: true, stationClosureNotice: true, transferAlerts: true },
    hasSeenOnboarding: false,
    signedInAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

/** 20% off for student / senior / PWD (RA 11314). */
function calculateFare(stationCount, commuterType) {
  const base = Math.min(35, 15 + stationCount * 1.25);
  const roundedBase = Math.round(base);
  const isDiscounted = commuterType !== 'regular';
  const discounted = isDiscounted ? Math.round(roundedBase * 0.8) : roundedBase;
  return { base: roundedBase, discounted, hasDiscount: isDiscounted };
}

const R = 6371 // km

function toRad(deg) { return deg * Math.PI / 180 }

export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Greedy nearest-neighbor TSP starting from (startLat, startLon)
// Returns ordered array of client objects. Clients without GPS go last.
export function greedyRoute(startLat, startLon, clients) {
  const withGPS    = clients.filter(c => c.lat && c.lon)
  const withoutGPS = clients.filter(c => !c.lat || !c.lon)

  const remaining = [...withGPS]
  const ordered   = []
  let curLat = startLat
  let curLon = startLon

  while (remaining.length > 0) {
    let nearestIdx  = 0
    let nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(curLat, curLon, remaining[i].lat, remaining[i].lon)
      if (d < nearestDist) { nearestDist = d; nearestIdx = i }
    }
    const nearest = remaining.splice(nearestIdx, 1)[0]
    ordered.push(nearest)
    curLat = nearest.lat
    curLon = nearest.lon
  }

  return [...ordered, ...withoutGPS]
}

export function distKm(lat1, lon1, lat2, lon2) {
  return haversine(lat1, lon1, lat2, lon2).toFixed(1)
}

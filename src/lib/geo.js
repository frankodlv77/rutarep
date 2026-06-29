const R = 6371 // km

function toRad(deg) { return deg * Math.PI / 180 }

export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function routeTotalDist(startLat, startLon, route) {
  if (route.length === 0) return 0
  let d = haversine(startLat, startLon, route[0].lat, route[0].lon)
  for (let i = 0; i < route.length - 1; i++) {
    d += haversine(route[i].lat, route[i].lon, route[i + 1].lat, route[i + 1].lon)
  }
  return d
}

// 2-opt: swap edge pairs to eliminate crossings. Improves greedy output.
function twoOpt(startLat, startLon, route) {
  let best = [...route]
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i + 1),
          ...best.slice(i + 1, j + 1).reverse(),
          ...best.slice(j + 1),
        ]
        if (routeTotalDist(startLat, startLon, candidate) < routeTotalDist(startLat, startLon, best)) {
          best = candidate
          improved = true
        }
      }
    }
  }
  return best
}

// Greedy nearest-neighbor + 2-opt improvement TSP starting from (startLat, startLon)
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

  const optimized = twoOpt(startLat, startLon, ordered)
  return [...optimized, ...withoutGPS]
}

export function distKm(lat1, lon1, lat2, lon2) {
  return haversine(lat1, lon1, lat2, lon2).toFixed(1)
}

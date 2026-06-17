export default async function handler(req, res) {
  const appId = process.env.BANDSINTOWN_APP_ID
  if (!appId) {
    console.warn(
      "[bandsintown] BANDSINTOWN_APP_ID is not set — returning no shows. " +
        "Add it to .env.development and your host's environment variables."
    )
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate")
    res.status(200).json([])
    return
  }
  try {
    const response = await fetch(
      `https://rest.bandsintown.com/artists/virya/events?app_id=${appId}&date=upcoming`,
      { headers: { Accept: "application/json" } }
    )
    if (!response.ok) {
      res.status(200).json([])
      return
    }
    const data = await response.json()
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate")
    res.status(200).json(Array.isArray(data) ? data : [])
  } catch {
    res.status(500).json([])
  }
}

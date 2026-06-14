const APP_ID =
  process.env.BANDSINTOWN_APP_ID || "3cfcaea901e7597c0e1b683b76a2a134"

export default async function handler(req, res) {
  try {
    const response = await fetch(
      `https://rest.bandsintown.com/artists/virya/events?app_id=${APP_ID}`
    )
    if (!response.ok) {
      res.status(response.status).json([])
      return
    }
    const data = await response.json()
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate")
    res.status(200).json(Array.isArray(data) ? data : [])
  } catch {
    res.status(500).json([])
  }
}

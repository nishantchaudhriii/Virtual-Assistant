// ---------------------------------------------------------------------------
// Voice helpers
// ---------------------------------------------------------------------------
export const normWord = (w) =>
  w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "")

export const editDistance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// Speech recognition often mishears names ("Shifra" -> "Sifra", "Shifa"), so match loosely.
export const nameMatches = (heard, name) => {
  if (!heard || !name) return false
  if (heard === name) return true
  const tolerance = name.length <= 3 ? 0 : name.length <= 6 ? 1 : 2
  return editDistance(heard, name) <= tolerance
}

// Returns { heard: boolean, command: string } where command is the sentence without the name.
export const extractCommand = (transcript, assistantName) => {
  const tokens = transcript.split(/\s+/).filter(Boolean)
  const nameParts = assistantName.split(/\s+/).map(normWord).filter(Boolean)
  const nameJoined = nameParts.join("")
  const norm = tokens.map(normWord)

  for (let i = 0; i < tokens.length; i++) {
    // whole name as one heard word (e.g. "shifra"), or as the same number of words ("shi fra")
    const span = nameParts.length
    if (nameMatches(norm[i], nameJoined)) {
      const rest = [...tokens.slice(0, i), ...tokens.slice(i + 1)]
      return { heard: true, command: rest.join(" ").replace(/^[\s,.:;!?-]+/, "").trim() }
    }
    if (span > 1 && i + span <= tokens.length && nameMatches(norm.slice(i, i + span).join(""), nameJoined)) {
      const rest = [...tokens.slice(0, i), ...tokens.slice(i + span)]
      return { heard: true, command: rest.join(" ").replace(/^[\s,.:;!?-]+/, "").trim() }
    }
    // name split by the recogniser into two words ("shi" + "fra")
    if (span === 1 && i + 1 < tokens.length && nameMatches(norm[i] + norm[i + 1], nameJoined)) {
      const rest = [...tokens.slice(0, i), ...tokens.slice(i + 2)]
      return { heard: true, command: rest.join(" ").replace(/^[\s,.:;!?-]+/, "").trim() }
    }
  }
  return { heard: false, command: transcript.trim() }
}

export const hasDevanagari = (text) => /[\u0900-\u097F]/.test(text)

// Prefer voices that run on this computer. Network voices ("Google ...") add a delay before
// speaking and are known to stop mid-sentence without ever telling us they finished.
export const pickVoice = (voices, wantHindi) => {
  const langs = wantHindi ? ["hi-IN", "hi"] : ["en-IN", "en-US", "en-GB", "en"]
  for (const l of langs) {
    const local = voices.find((v) => v.localService && v.lang.replace("_", "-").toLowerCase().startsWith(l.toLowerCase()))
    if (local) return local
  }
  for (const l of langs) {
    const any = voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(l.toLowerCase()))
    if (any) return any
  }
  return null
}

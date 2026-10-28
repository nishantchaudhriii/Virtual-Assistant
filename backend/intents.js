import moment from "moment"

// Instant, offline intent detection.
// Simple commands (time, date, day, month, open an app, search/play) are answered right here
// in about a millisecond, without calling Gemini. Anything else falls through to Gemini.
//
// Every pattern is anchored (^ ... $) so a sentence only matches when it is really *that*
// question. "what is the time complexity of quicksort" must NOT be answered with the clock time.

export const normalize = (text = "") =>
    String(text)
        .toLowerCase()
        .replace(/[’']/g, "")            // what's -> whats
        .replace(/[^\p{L}\p{N}\s]/gu, " ") // drop punctuation (keeps Hindi/Devanagari letters)
        .replace(/\s+/g, " ")
        .trim()

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Remove the assistant's name (and filler like "hey") from the start/anywhere of the sentence.
export const stripAssistantName = (text = "", assistantName = "") => {
    let out = String(text)
    const name = String(assistantName || "").trim()
    if (name) {
        out = out.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, "gi"), " ")
    }
    return out.replace(/^[\s,.:;!?-]+/, "").replace(/\s+/g, " ").trim()
}

const POLITE = "(?:please |pls |can you |could you |will you |would you |hey |hi |ok |okay |so |now |abhi |zara |bas )*"
const ASK = "(?:tell me |tell |say |show me |show |give me |what is |what s |whats |whats the |what are |batao |bata do |bataiye |btao )*"
const TAIL = "(?: now| right now| today| please| pls| abhi| ab| for me| bata do| batao| bataiye)*"

const TIME_RE = [
    new RegExp(`^${POLITE}${ASK}(?:the )?(?:current |exact |local |correct )?time${TAIL}(?: is it| hai| hua hai| hua| kya hai| kya hua hai| kya hua| kitna hai| kitna hua hai)?${TAIL}$`),
    new RegExp(`^${POLITE}what time is it${TAIL}$`),
    new RegExp(`^${POLITE}(?:abhi |ab )?kitne baje(?: hain| hai| hue hain| hue hai)?${TAIL}$`),
    new RegExp(`^${POLITE}(?:abhi |ab )?(?:ka )?samay(?: kya| kitna)?(?: hai| hua hai| hua)?${TAIL}$`),
    new RegExp(`^${POLITE}do you (?:know|have) the time${TAIL}$`),
]

const DATE_RE = [
    new RegExp(`^${POLITE}${ASK}(?:the )?(?:todays |current |exact )?date${TAIL}(?: is it| hai| kya hai| kya hai aaj| today| aaj ki)?${TAIL}$`),
    new RegExp(`^${POLITE}what date is it${TAIL}$`),
    new RegExp(`^${POLITE}what is (?:the )?date today$`),
    new RegExp(`^${POLITE}(?:aaj ki |aaj ka |aj ki |aj ka )?(?:date|tarikh|tareekh)(?: kya| kitni)?(?: hai| hui hai)?${TAIL}$`),
]

const DAY_RE = [
    new RegExp(`^${POLITE}${ASK}(?:the )?(?:todays |current )?day${TAIL}(?: is it| is today| today| hai| kya hai| aaj)?${TAIL}$`),
    new RegExp(`^${POLITE}what day (?:is it|is today|of the week is it|of the week is today)${TAIL}$`),
    new RegExp(`^${POLITE}which day (?:is it|is today)${TAIL}$`),
    new RegExp(`^${POLITE}(?:aaj |aj )?(?:kaun sa|konsa|kon sa) din(?: hai| h)?${TAIL}$`),
    new RegExp(`^${POLITE}(?:aaj |aj )?(?:kya )?din(?: kya)? hai${TAIL}$`),
    new RegExp(`^${POLITE}what is today$`),
]

const MONTH_RE = [
    new RegExp(`^${POLITE}${ASK}(?:the )?(?:current |this )?month${TAIL}(?: is it| is this| hai| kya hai)?${TAIL}$`),
    new RegExp(`^${POLITE}what month (?:is it|is this|are we in)${TAIL}$`),
    new RegExp(`^${POLITE}which month (?:is it|is this|are we in)${TAIL}$`),
    new RegExp(`^${POLITE}(?:kaun sa|konsa|kon sa) (?:mahina|mahine|month)(?: hai| chal raha hai| chal raha h)?${TAIL}$`),
]

const OPEN = "(?:open|launch|start|run|kholo|khol do|khol|chalu karo|chalao)"
const CALC_RE = new RegExp(`^${POLITE}(?:${OPEN} )?(?:the )?calculator(?: ${OPEN}| kholo| open)?${TAIL}$`)
const INSTA_RE = new RegExp(`^${POLITE}(?:${OPEN} )(?:the )?instagram(?: app)?${TAIL}$|^${POLITE}instagram(?: ${OPEN})${TAIL}$`)
const FB_RE = new RegExp(`^${POLITE}(?:${OPEN} )(?:the )?facebook(?: app)?${TAIL}$|^${POLITE}facebook(?: ${OPEN})${TAIL}$`)
const WEATHER_RE = new RegExp(`^${POLITE}(?:${ASK})?(?:the )?(?:todays |current )?weather(?: report| update| forecast)?${TAIL}(?: today| outside| here| kaisa hai| kaisa| kya hai| hai)?${TAIL}$`)

const anyMatch = (list, s) => list.some((re) => re.test(s))

// "search X on google" / "google X" / "search for X"
const GOOGLE_RES = [
    /^(?:please |can you |could you )?(?:search|google|look up|find)(?: for)? (.+?) (?:on|in|using) google$/,
    /^(?:please |can you |could you )?google (?:search )?(?:for )?(.+)$/,
    /^(?:please |can you |could you )?google pe (.+?) (?:search karo|search kar|dhundo|dhoondo)$/,
    /^(?:please |can you |could you )?(?:search|look up)(?: for)? (.+)$/,
]
const YT_SEARCH_RES = [
    /^(?:please |can you |could you )?(?:search|find|look up)(?: for)? (.+?) (?:on|in|using) youtube$/,
    /^(?:please |can you |could you )?youtube (?:search )?(?:for )?(.+)$/,
    /^(?:please |can you |could you )?youtube pe (.+?) (?:search karo|search kar|dhundo|dhoondo)$/,
]
const YT_PLAY_RES = [
    /^(?:please |can you |could you )?play (.+?) (?:on|in|using) youtube$/,
    /^(?:please |can you |could you )?(?:play|chalao|chala do|bajao|baja do) (.+)$/,
    /^(?:please |can you |could you )?(.+?) (?:chalao|chala do|bajao|baja do|play karo)$/,
]

const firstCapture = (list, s) => {
    for (const re of list) {
        const m = s.match(re)
        if (m && m[1] && m[1].trim()) return m[1].trim()
    }
    return null
}

/**
 * Returns { type, userInput, response } when the sentence is a simple, unambiguous command,
 * otherwise null (meaning: ask Gemini).
 */
export const detectLocalIntent = (rawCommand, assistantName = "") => {
    const cleaned = stripAssistantName(rawCommand, assistantName)
    const s = normalize(cleaned)
    if (!s) return null
    const now = moment()

    if (anyMatch(TIME_RE, s)) {
        return { type: "get-time", userInput: cleaned, response: `The time is ${now.format("h:mm A")}` }
    }
    if (anyMatch(DATE_RE, s)) {
        return { type: "get-date", userInput: cleaned, response: `Today's date is ${now.format("D MMMM YYYY")}` }
    }
    if (anyMatch(DAY_RE, s)) {
        return { type: "get-day", userInput: cleaned, response: `Today is ${now.format("dddd")}` }
    }
    if (anyMatch(MONTH_RE, s)) {
        return { type: "get-month", userInput: cleaned, response: `The current month is ${now.format("MMMM")}` }
    }
    if (CALC_RE.test(s)) return { type: "calculator-open", userInput: cleaned, response: "Opening calculator" }
    if (INSTA_RE.test(s)) return { type: "instagram-open", userInput: cleaned, response: "Opening Instagram" }
    if (FB_RE.test(s)) return { type: "facebook-open", userInput: cleaned, response: "Opening Facebook" }
    if (WEATHER_RE.test(s)) return { type: "weather-show", userInput: cleaned, response: "Here is the weather" }

    // Order matters: "on youtube" forms must be tried before the generic "search X" form.
    const ytSearch = firstCapture(YT_SEARCH_RES, s)
    if (ytSearch) return { type: "youtube-search", userInput: ytSearch, response: `Searching YouTube for ${ytSearch}` }

    const ytPlayExplicit = s.match(YT_PLAY_RES[0])
    if (ytPlayExplicit?.[1]) {
        const q = ytPlayExplicit[1].trim()
        return { type: "youtube-play", userInput: q, response: `Playing ${q} on YouTube` }
    }

    const google = firstCapture(GOOGLE_RES, s)
    if (google) return { type: "google-search", userInput: google, response: `Searching Google for ${google}` }

    const ytPlay = firstCapture(YT_PLAY_RES.slice(1), s)
    if (ytPlay) return { type: "youtube-play", userInput: ytPlay, response: `Playing ${ytPlay} on YouTube` }

    return null
}

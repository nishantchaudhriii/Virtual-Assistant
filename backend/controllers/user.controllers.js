<<<<<<< HEAD
import uploadOnCloudinary from "../config/cloudinary.js"
import geminiResponse from "../gemini.js"
import User from "../models/user.model.js"
import { detectLocalIntent, stripAssistantName } from "../intents.js"

// Small in-memory cache so we don't hit MongoDB on every spoken command just to read
// the user's name / assistant name (they change rarely).
const userCache = new Map()
const USER_CACHE_TTL_MS = 60 * 1000
const getUserLite = async (userId) => {
    const key = String(userId)
    const hit = userCache.get(key)
    if (hit && Date.now() - hit.at < USER_CACHE_TTL_MS) return hit.user
    const user = await User.findById(userId).select("name assistantName").lean()
    if (user) userCache.set(key, { user, at: Date.now() })
    return user
}

// Save history in the background (and keep only the last 50 items) - never make the user wait for it.
const saveHistory = (userId, command) => {
    User.updateOne({ _id: userId }, { $push: { history: { $each: [command], $slice: -50 } } })
        .catch((err) => console.error("history save error:", err.message))
}

// Pull the spoken answer out of Gemini's reply even if the JSON is slightly broken/truncated.
const parseGeminiReply = (raw) => {
    const text = String(raw || "").trim()
    if (!text) return null

    const match = text.match(/{[\s\S]*}/)
    if (match) {
        try {
            const obj = JSON.parse(match[0])
            if (obj && typeof obj === "object") return obj
        } catch { /* fall through to the rescue paths below */ }
    }

    const typeMatch = text.match(/"type"\s*:\s*"([^"]+)"/)
    const respMatch = text.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)/)
    if (respMatch) {
        let response = respMatch[1]
        try { response = JSON.parse(`"${response}"`) } catch { /* keep as is */ }
        return { type: typeMatch?.[1] || "general", response }
    }

    // Gemini answered in plain text instead of JSON - just speak it.
    if (!text.startsWith("{")) return { type: "general", response: text }
    return null
}

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password")
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }
        return res.status(200).json(user)
    } catch (error) {
        return res.status(400).json({ message: "get current user error" })
    }
}

export const updateAssistant = async (req, res) => {
    try {
        const { assistantName, imageUrl } = req.body
        let assistantImage

        if (req.file) {
            const cloudUrl = await uploadOnCloudinary(req.file.path)
            // Fallback when Cloudinary isn't configured: serve the file from this server
            assistantImage = cloudUrl || `${req.protocol}://${req.get("host")}/public/${req.file.filename}`
        } else {
            assistantImage = imageUrl
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { assistantName, assistantImage },
            { new: true }
        ).select("-password")

        userCache.delete(String(req.userId))
        return res.status(200).json(user)
    } catch (error) {
        console.error("updateAssistant error:", error)
        return res.status(400).json({ message: "updateAssistantError user error" })
    }
}

const TIME_TYPES = ["get-time", "get-date", "get-day", "get-month"]
const PASS_THROUGH_TYPES = [
    "general", "google-search", "youtube-search", "youtube-play", "website-open",
    "calculator-open", "instagram-open", "facebook-open", "weather-show",
]

export const askToAssistant = async (req, res) => {
    const startedAt = Date.now()
    try {
        let command = typeof req.body?.command === "string" ? req.body.command.trim() : ""
        if (!command) {
            return res.status(400).json({ response: "I didn't catch that. Please say it again." })
        }
        command = command.slice(0, 500)

        const user = await getUserLite(req.userId)
        if (!user) {
            return res.status(400).json({ response: "user not found" })
        }

        saveHistory(req.userId, command) // fire-and-forget

        // 1) Fast path: simple commands are answered instantly, without calling Gemini.
        const local = detectLocalIntent(command, user.assistantName)
        if (local) {
            console.log(`⚡ local intent "${local.type}" in ${Date.now() - startedAt}ms`)
            return res.json(local)
        }

        // 2) Everything else goes to Gemini.
        const cleanedCommand = stripAssistantName(command, user.assistantName) || command
        const result = await geminiResponse(cleanedCommand, user.assistantName, user.name)
        if (!result) {
            return res.status(502).json({
                response: "Sorry, I am having trouble thinking right now. Please try again in a moment."
            })
        }

        const gemResult = parseGeminiReply(result)
        if (!gemResult) {
            return res.status(200).json({
                type: "general", userInput: cleanedCommand,
                response: "Sorry, I could not understand that. Could you say it again?"
            })
        }

        let type = gemResult.type
        const userInput = gemResult.userInput || cleanedCommand
        const spoken = typeof gemResult.response === "string" ? gemResult.response.trim() : ""

        // The old code replaced the AI's answer with the clock time whenever the AI picked a
        // "get-time"-style type - even for unrelated questions. Now the clock is only used when
        // the sentence really is a time/date question (handled by the fast path above).
        // If the AI still returns one of those types here, trust its own answer instead.
        if (TIME_TYPES.includes(type)) type = "general"

        if (!PASS_THROUGH_TYPES.includes(type)) type = "general"

        if (!spoken) {
            return res.status(200).json({
                type: "general", userInput,
                response: "Sorry, I don't have an answer for that."
            })
        }

        console.log(`🤖 gemini intent "${type}" in ${Date.now() - startedAt}ms total`)
        return res.json({ type, userInput, response: spoken })
    } catch (error) {
        console.error("askToAssistant error:", error)
        return res.status(500).json({ response: "Sorry, something went wrong on my side." })
    }
}
=======
 import uploadOnCloudinary from "../config/cloudinary.js"
import geminiResponse from "../gemini.js"
import User from "../models/user.model.js"
import moment from "moment"
 export const getCurrentUser=async (req,res)=>{
    try {
        const userId=req.userId
        const user=await User.findById(userId).select("-password")
        if(!user){
return res.status(400).json({message:"user not found"})
        }

   return res.status(200).json(user)     
    } catch (error) {
       return res.status(400).json({message:"get current user error"}) 
    }
}

export const updateAssistant=async (req,res)=>{
   try {
      const {assistantName,imageUrl}=req.body
      let assistantImage;
if(req.file){
   assistantImage=await uploadOnCloudinary(req.file.path)
}else{
   assistantImage=imageUrl
}

const user=await User.findByIdAndUpdate(req.userId,{
   assistantName,assistantImage
},{new:true}).select("-password")
return res.status(200).json(user)

      
   } catch (error) {
       return res.status(400).json({message:"updateAssistantError user error"}) 
   }
}


export const askToAssistant=async (req,res)=>{
   try {
      const {command}=req.body
      const user=await User.findById(req.userId);
      user.history.push(command)
      user.save()
      const userName=user.name
      const assistantName=user.assistantName
      const result=await geminiResponse(command,assistantName,userName)

      const jsonMatch=result.match(/{[\s\S]*}/)
      if(!jsonMatch){
         return res.ststus(400).json({response:"sorry, i can't understand"})
      }
      const gemResult=JSON.parse(jsonMatch[0])
      console.log(gemResult)
      const type=gemResult.type

      switch(type){
         case 'get-date' :
            return res.json({
               type,
               userInput:gemResult.userInput,
               response:`current date is ${moment().format("YYYY-MM-DD")}`
            });
            case 'get-time':
                return res.json({
               type,
               userInput:gemResult.userInput,
               response:`current time is ${moment().format("hh:mm A")}`
            });
             case 'get-day':
                return res.json({
               type,
               userInput:gemResult.userInput,
               response:`today is ${moment().format("dddd")}`
            });
            case 'get-month':
                return res.json({
               type,
               userInput:gemResult.userInput,
               response:`today is ${moment().format("MMMM")}`
            });
      case 'google-search':
      case 'youtube-search':
      case 'youtube-play':
      case 'general':
      case  "calculator-open":
      case "instagram-open": 
       case "facebook-open": 
       case "weather-show" :
         return res.json({
            type,
            userInput:gemResult.userInput,
            response:gemResult.response,
         });

         default:
            return res.status(400).json({ response: "I didn't understand that command." })
      }
     

   } catch (error) {
  return res.status(500).json({ response: "ask assistant error" })
   }
}
>>>>>>> origin/main

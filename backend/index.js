import express from "express"
import dotenv from "dotenv"
dotenv.config()
import path from "path"
import { fileURLToPath } from "url"
import cors from "cors"
import cookieParser from "cookie-parser"
import connectDb from "./config/db.js"
import authRouter from "./routes/auth.routes.js"
import userRouter from "./routes/user.routes.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
// NOTE: macOS uses port 5000 for AirPlay Receiver, so we default to 8000 instead.
const port = process.env.PORT || 8000

// Allow the Vite dev server on any localhost / 127.0.0.1 port (Vite moves to 5174 if 5173 is busy)
const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/
const extraOrigins = [process.env.CLIENT_URL].filter(Boolean)

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || localhostRegex.test(origin) || extraOrigins.includes(origin)) {
            return cb(null, true)
        }
        return cb(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())
app.use("/public", express.static(path.join(__dirname, "public")))

app.get("/api/health", (req, res) => res.json({ ok: true }))
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)

const start = async () => {
    // Connect to the DB first: if it fails we print the real reason and exit,
    // instead of starting a server whose every request silently hangs.
    await connectDb()
    app.listen(port, () => {
        console.log(`server started on http://localhost:${port}`)
    })
}
start()

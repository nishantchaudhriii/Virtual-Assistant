<<<<<<< HEAD
import multer from "multer"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Absolute path so uploads work no matter which folder you start the server from
const uploadDir = path.join(__dirname, "..", "public")
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
    }
})

const upload = multer({ storage })
export default upload
=======
import multer from "multer"

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,"./public")
    },
    filename:(req,file,cb)=>{
        cb(null,file.originalname)
    }
})

const upload=multer({storage})
export default upload
>>>>>>> origin/main

<<<<<<< HEAD
import mongoose from "mongoose"

const connectDb = async () => {
    const url = process.env.MONGODB_URL
    if (!url) {
        console.error("\n❌ MONGODB_URL is not set. Copy backend/.env.example to backend/.env and fill it in.\n")
        process.exit(1)
    }
    try {
        await mongoose.connect(url, { serverSelectionTimeoutMS: 8000 })
        console.log("db connected")
    } catch (error) {
        console.error("\n❌ MongoDB connection failed:", error.message)
        console.error("   - Local MongoDB: run `brew services start mongodb-community`")
        console.error("   - Atlas: check the password in the URL and add your IP under Network Access\n")
        process.exit(1)
    }
}

export default connectDb
=======
import mongoose from "mongoose"

const connectDb=async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("db connected")
    } catch (error) {
        console.log(error)
    }
}

export default connectDb
>>>>>>> origin/main

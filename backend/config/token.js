<<<<<<< HEAD
import jwt from "jsonwebtoken"

const genToken = async (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not set in backend/.env")
    }
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10d" })
}

export default genToken
=======
import jwt from "jsonwebtoken"
const genToken=async (userId)=>{
    try {
        const token = await jwt.sign({userId},process.env.JWT_SECRET,{expiresIn:"10d"})
        return token
    } catch (error) {
        console.log(error)
    }
}

export default genToken
>>>>>>> origin/main

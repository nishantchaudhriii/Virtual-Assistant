import jwt from "jsonwebtoken"

const genToken = async (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not set in backend/.env")
    }
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10d" })
}

export default genToken
